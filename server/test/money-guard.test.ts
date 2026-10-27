import { describe, expect, it } from 'vitest'
import { deliverInput } from '../src/agent/inbox.js'
import { defaultGuards } from '../src/agent/guards.js'
import { Agent } from '../src/agent/loop.js'
import type { ModelReply } from '../src/agent/providers/types.js'
import { buildTools, declarations } from '../src/agent/tools.js'
import { cardCarriesMoney, mentionsMoney } from '../src/domain/money.js'
import { testApp } from './helpers.js'

const decision = {
  name: 'log_decision',
  args: {
    received: 'cab booked',
    source: 'Beckn on_confirm',
    decided: 'tell the group the status and the RP the cost',
    rule_id: 'R18',
    why: 'the group never hears what something cost',
    action: 'posting',
    recipient: 'family_group',
    connector: 'In-app message',
  },
}
const send = (to: string, text: string, card?: object) => ({
  name: 'send_message',
  args: { to, text, language: 'en-IN', ...(card ? { card: JSON.stringify(card) } : {}) },
})

async function run(reply: ModelReply) {
  const { rt, operator } = testApp()
  let i = 0
  const agent = new Agent(rt, {
    provider: { label: 'test', run: async () => (i++ === 0 ? reply : { text: 'done', toolCalls: [] }) },
    tools: () => buildTools(rt),
    declarations,
    operator,
    systemPrompt: () => 'system',
    guards: defaultGuards(),
  })
  deliverInput(rt, { kind: 'test', source: 'R18 check' })
  await agent.settled()
  const results = rt.history.all().flatMap((t) => (t.role === 'tool' ? t.results.map((r) => r.result) : []))
  return { rt, results }
}

describe('R18: figures never reach the family group', () => {
  it('refuses a cost sent to the group, lets the status line through, and gives the RP the figure', async () => {
    const { rt, results } = await run({
      text: '',
      toolCalls: [
        decision,
        send('family_group', 'Booked her cab, paid Rs 420 from the wallet.'),
        send('family_group', 'Amma is on her way to the clinic and I am handling it.'),
        send('rp', 'Paid Rs 420 for the cab to the clinic.'),
      ],
    })
    expect(results[1]).toMatchObject({
      ok: false,
      rule: 'R18',
      error: expect.stringMatching(/^R18: the family group gets status only/),
    })
    expect(results[2]).toMatchObject({ ok: true })
    expect(results[3]).toMatchObject({ ok: true })
    expect(rt.threads.thread('family_group').map((m) => m.text)).toEqual([
      'Amma is on her way to the clinic and I am handling it.',
    ])
    expect(rt.threads.thread('rp')).toHaveLength(1)
  })

  it('refuses a card for the group that carries an amount', async () => {
    const { rt, results } = await run({
      text: '',
      toolCalls: [decision, send('family_group', 'Cab booked.', { kind: 'payment', amount_inr: 420 })],
    })
    expect(results[1]).toMatchObject({ ok: false, rule: 'R18' })
    expect(rt.threads.thread('family_group')).toEqual([])
  })

  it('reads a figure in the forms the product writes, and leaves other numbers alone', () => {
    for (const t of [
      'paid Rs 420',
      'Rs. 420',
      '₹420',
      '₹ 420',
      'INR 420',
      '420 rupees',
      '420rs',
      '320 INR',
    ]) {
      expect(mentionsMoney(t), t).toBe(true)
    }
    for (const t of ["the 2 o'clock slot", 'Dr. S. Rao at 4:30 pm', 'room 12', 'RX-WGL-2026-0612']) {
      expect(mentionsMoney(t), t).toBe(false)
    }
    expect(cardCarriesMoney({ kind: 'booking', total_inr: 620 })).toBe(true)
    expect(cardCarriesMoney({ kind: 'booking', title: 'Clinic visit booked' })).toBe(false)
  })
})
