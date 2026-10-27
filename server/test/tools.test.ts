import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseEnv } from '../src/config/env.js'
import { fromRoot } from '../src/config/paths.js'
import { readRules, ruleIds, systemPrompt } from '../src/agent/prompt.js'
import { toGeminiSchema } from '../src/agent/providers/gemini.js'
import { startAgent } from '../src/agent/start.js'
import { buildTools, declarations } from '../src/agent/tools.js'
import { DecisionLog } from '../src/store/decisions.js'
import { testApp, testRuntime } from './helpers.js'

/** Runs one LIVE tool's handler as the loop would, arguments checked first. */
async function call(rt: ReturnType<typeof testRuntime>, name: string, args: object) {
  const tool = buildTools(rt).find((t) => t.name === name)!
  const parsed = tool.schema.safeParse(args)
  if (!parsed.success) return { ok: false, error: parsed.error.message }
  return tool.handler!(parsed.data, { rt, callId: 'c1' }) as { ok: boolean; [k: string]: unknown }
}

/**
 * Tools the stub scripts call that later stages build. This list must be empty
 * by the end of Stage 7.
 */
const NOT_BUILT_YET = new Set([
  'wait_for_reply',
  'next_contact',
  'record_account',
  'record_assessment',
  'open_reversal_window',
  'ask_followup',
  'summarise_account',
  'next_provider',
  'record_provider_outcome',
  'record_fulfilment',
  'record_dispatch',
  'wallet_ledger_append',
  'quote_care',
  'settle_care',
  'order_medicines',
  'book_test',
  'set_refill_cycle',
  'beckn_search',
  'beckn_confirm',
])

describe('the system prompt', () => {
  it('defines R1 to R24, in order', () => {
    expect(ruleIds()).toEqual(Array.from({ length: 24 }, (_, i) => `R${i + 1}`))
  })

  it('names no removed rail or channel, and no tool that does not exist', () => {
    const rules = readRules()
    const vendors = [
      ['what', 'sapp'],
      ['gna', 'ni'],
      ['pine', ' ?labs'],
      ['delh', 'ivery'],
      ['sar', 'vam'],
      ['vach', 'ana'],
    ]
    for (const v of vendors) expect(rules).not.toMatch(new RegExp(v.join(''), 'i'))
    expect(rules).not.toMatch(/a rail returns/)
  })

  it('carries the onboarding data under the rules, and nothing else', () => {
    const rt = testRuntime()
    const prompt = systemPrompt(rt)
    expect(prompt.startsWith(readRules())).toBe(true)
    const rest = prompt.slice(readRules().length)
    expect(rest).toBe(
      `\n\n---\n\n# Onboarding data for this family\n\n\`\`\`json\n${JSON.stringify(rt.onboarding(), null, 2)}\n\`\`\``,
    )
  })
})

describe('the tool catalogue', () => {
  const rt = testRuntime()
  const tools = buildTools(rt)

  it('declares every tool from its zod schema, in a shape each provider takes', () => {
    for (const d of declarations(tools)) {
      expect(d.parameters).not.toHaveProperty('$schema')
      expect(d.parameters.type).toBe('object')
      expect(JSON.stringify(toGeminiSchema(d.parameters))).not.toMatch(/additionalProperties|anyOf|\$schema/)
    }
  })

  it('offers only recipients the family data has', () => {
    const send = declarations(tools).find((d) => d.name === 'send_message')!
    const to = (send.parameters.properties as Record<string, { enum: string[] }>).to
    expect(to?.enum).toEqual(['patient', 'rp', 'member_3', 'family_group', 'doctor'])
  })

  it('knows every tool the stub scripts call, or lists it as still to build', () => {
    const names = new Set(tools.map((t) => t.name))
    const scripts = [
      JSON.parse(readFileSync(fromRoot('config/stub-script.json'), 'utf8')),
      ...Object.values(JSON.parse(readFileSync(fromRoot('config/stub-scenarios.json'), 'utf8')).bands),
      ...Object.values(JSON.parse(readFileSync(fromRoot('config/stub-scenarios.json'), 'utf8')).samples),
    ] as { toolCalls: { name: string }[] }[][]
    for (const turn of scripts.flat())
      for (const c of turn.toolCalls) {
        expect(names.has(c.name) || NOT_BUILT_YET.has(c.name), `${c.name} is neither built nor listed`).toBe(
          true,
        )
      }
    for (const n of NOT_BUILT_YET) expect(names.has(n), `${n} is built; take it off the list`).toBe(false)
  })
})

describe('the tools that exist now', () => {
  it('log_decision writes a row to the decision log and says so on the stream', async () => {
    const rt = testRuntime()
    const out = await call(rt, 'log_decision', {
      received: 'Refill check',
      source: 'Clock, refill cycle check',
      decided: 'Call the chemist',
      rule_id: 'R3',
      why: 'three days left',
      action: 'calling',
      recipient: 'Pillar Road Medicals, Hanamkonda',
      connector: 'Phone',
    })
    expect(out).toEqual({ ok: true, row_number: 1 })
    expect(new DecisionLog(rt).all()[0]).toMatchObject({ rule_id: 'R3', when: '2026-10-06T03:42:00.000Z' })
    expect(rt.log.since().at(-1)?.type).toBe('decision')
  })

  it('set_stage moves the stage and says why', async () => {
    const rt = testRuntime()
    await call(rt, 'set_stage', { stage: 2, why: 'refill due' })
    expect(rt.session.get('stage')).toBe(2)
    expect(rt.log.since().at(-1)).toMatchObject({ type: 'stage', stage: 2, why: 'refill due' })
  })

  it('send_message puts the message in that person thread, with its card, and refuses a card that is not JSON', async () => {
    const rt = testRuntime()
    await call(rt, 'send_message', {
      to: 'rp',
      text: 'OK to pay?',
      language: 'en-IN',
      card: '{"kind":"spend_above_threshold"}',
    })
    expect(rt.threads.thread('rp')[0]).toMatchObject({
      from: 'agent',
      text: 'OK to pay?',
      card: { kind: 'spend_above_threshold' },
    })
    expect(
      await call(rt, 'send_message', { to: 'rp', text: 'x', language: 'en-IN', card: '{oops' }),
    ).toMatchObject({ ok: false })
    expect(await call(rt, 'send_message', { to: 'neighbour', text: 'x', language: 'en-IN' })).toMatchObject({
      ok: false,
    })
  })

  it('record_update changes the record, and refuses a change that would leave it invalid', async () => {
    const rt = testRuntime()
    const ok = await call(rt, 'record_update', {
      target: 'medicine',
      id: 'med_chronic_1',
      changes:
        '{"last_filled_at": "Pillar Road Medicals, Hanamkonda", "last_filled_on": "2026-10-06", "last_filled_quantity": 30}',
      why: 'where this strip came from',
    })
    expect(ok.ok).toBe(true)
    expect(rt.onboarding().current_medicines[0]).toMatchObject({ last_filled_quantity: 30 })

    const bad = await call(rt, 'record_update', {
      target: 'medicine',
      id: 'med_chronic_1',
      changes: '{"colour": "blue"}',
      why: 'x',
    })
    expect(bad).toMatchObject({ ok: false })
    expect(rt.onboarding().current_medicines[0]).not.toHaveProperty('colour')
    expect(
      await call(rt, 'record_update', {
        target: 'medicine',
        id: 'med_chronic_1',
        changes: '{"id": "x"}',
        why: 'x',
      }),
    ).toMatchObject({ ok: false })
  })

  it('place_call refuses a number that is not in the onboarding data', () => {
    const rt = testRuntime()
    const place = buildTools(rt).find((t) => t.name === 'place_call')!
    expect(
      place.check!({ to: 'x', phone: '+91-99999-99999', purpose: 'x', say: 'x' }, { rt, callId: 'c' }),
    ).toMatchObject({ ok: false })
    expect(
      place.check!({ to: 'x', phone: '108', purpose: 'x', say: 'x' }, { rt, callId: 'c' }),
    ).toBeUndefined()
  })
})

describe('a stub run from a trigger', () => {
  it('logs a decision, moves the stage, sends a message, then waits on the person it called', async () => {
    const { rt, operator, app } = testApp()
    const env = parseEnv({ MODEL_PROVIDER: 'stub', STUB_THINK_MS: '0' })
    const { agent } = startAgent(rt, env, operator, { databasePath: ':memory:' })
    const request = (await import('supertest')).default
    await request(app).post('/api/clock').send({ to_next_date: true, source: 'refill date' })
    await new Promise((r) => setTimeout(r, 50))

    expect(new DecisionLog(rt).all().map((d) => d.rule_id)).toEqual(['R3'])
    expect(rt.session.get('stage')).toBe(2)
    expect(rt.threads.thread('family_group')[0]?.text).toMatch(/running low/)
    expect(operator.pending().map((i) => i.tool)).toEqual(['place_call'])
    expect(rt.syncState()).toMatchObject({ running: true, model: 'stub (scripted, not a real model)' })
    agent.abort()
    operator.abandonAll('test over')
    await agent.settled()
  })
})
