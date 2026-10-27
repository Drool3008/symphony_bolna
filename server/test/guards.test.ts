import { describe, expect, it } from 'vitest'
import { deliverInput } from '../src/agent/inbox.js'
import { defaultGuards } from '../src/agent/guards.js'
import { Agent } from '../src/agent/loop.js'
import type { ModelReply } from '../src/agent/providers/types.js'
import { buildTools, declarations } from '../src/agent/tools.js'
import { DecisionLog } from '../src/store/decisions.js'
import { testApp } from './helpers.js'

const decision = (rule_id: string) => ({
  name: 'log_decision',
  args: {
    received: 'refill due',
    source: 'Clock, refill date from RX-WGL-2026-0612',
    decided: 'tell Arun',
    rule_id,
    why: 'three days left',
    action: 'messaged Arun',
    recipient: 'rp',
    connector: 'In-app message',
  },
})
const message = { name: 'send_message', args: { to: 'rp', text: 'hi', language: 'en-IN' } }

/** Runs the real catalogue and guards over a scripted model. */
async function run(replies: ModelReply[]) {
  const { rt, operator } = testApp()
  let i = 0
  const agent = new Agent(rt, {
    provider: { label: 'test', run: async () => replies[i++] ?? { text: 'done', toolCalls: [] } },
    tools: () => buildTools(rt),
    declarations,
    operator,
    systemPrompt: () => 'system',
    guards: defaultGuards(),
  })
  deliverInput(rt, { kind: 'clock', source: 'test' })
  await agent.settled()
  const results = rt.history.all().flatMap((t) => (t.role === 'tool' ? t.results : []))
  return { rt, results, decisions: new DecisionLog(rt).all() }
}

describe('R19: no action before a logged decision', () => {
  it('refuses a call made before any decision in its step, and nothing reaches a person', async () => {
    const { rt, results } = await run([{ text: '', toolCalls: [message] }])
    expect(results[0]?.result).toEqual({
      ok: false,
      rule: 'R19',
      error: 'R19: call log_decision for this choice first, in this same step, then make this call again.',
    })
    expect(rt.threads.thread('rp')).toEqual([])
    expect(rt.log.since().find((e) => e.type === 'tool_rejected')).toMatchObject({
      name: 'send_message',
      reason: 'R19',
    })
  })

  it('lets the same call through once a decision is logged first in that step', async () => {
    const { rt, decisions } = await run([{ text: '', toolCalls: [decision('R15'), message] }])
    expect(decisions.map((d) => d.rule_id)).toEqual(['R15'])
    expect(rt.threads.thread('rp').map((m) => m.text)).toEqual(['hi'])
  })

  it('does not carry a decision over into the next step', async () => {
    const { rt } = await run([
      { text: '', toolCalls: [decision('R15')] },
      { text: '', toolCalls: [message] },
    ])
    expect(rt.threads.thread('rp')).toEqual([])
  })

  it('lets a model that was refused correct itself, without the backend saying what to decide', async () => {
    const { rt, results } = await run([
      { text: '', toolCalls: [message] },
      { text: '', toolCalls: [decision('R15'), message] },
    ])
    const refusal = JSON.stringify(results[0]?.result)
    expect(refusal).not.toMatch(/R15|Arun|rp/)
    expect(rt.threads.thread('rp')).toHaveLength(1)
  })
})

describe('no rule the prompt lacks', () => {
  it('refuses a decision citing a rule that does not exist, and does not let it unlock the step', async () => {
    const { rt, results, decisions } = await run([{ text: '', toolCalls: [decision('R99'), message] }])
    expect(results[0]?.result).toMatchObject({
      ok: false,
      rule: 'rule_id',
      error: expect.stringMatching(/^rule_id must be one of R1, R2/),
    })
    expect(results[1]?.result).toMatchObject({ rule: 'R19' })
    expect(decisions).toEqual([])
    expect(rt.threads.thread('rp')).toEqual([])
  })

  it('tells the model the rules it may cite in the declaration itself', () => {
    const { rt } = testApp()
    const log = declarations(buildTools(rt)).find((d) => d.name === 'log_decision')!
    const ruleId = (log.parameters.properties as Record<string, { enum?: string[] }>).rule_id
    expect(ruleId?.enum).toHaveLength(24)
  })
})
