import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { deliverInput } from '../src/agent/inbox.js'
import { defaultGuards } from '../src/agent/guards.js'
import { Agent } from '../src/agent/loop.js'
import type { ModelReply } from '../src/agent/providers/types.js'
import { buildTools, declarations } from '../src/agent/tools.js'
import { loadOnboarding } from '../src/config/onboarding.js'
import { createRuntime } from '../src/runtime.js'
import { testApp } from './helpers.js'

const decision = {
  name: 'log_decision',
  args: {
    received: 'Kazipet has it at 320',
    source: 'Kazipet Pharmacy, phone call',
    decided: 'ask Arun before paying',
    rule_id: 'R15',
    why: 'above the 200 threshold',
    action: 'approval card to Arun',
    recipient: 'rp',
    connector: 'In-app message',
  },
}
const card = {
  name: 'send_message',
  args: {
    to: 'rp',
    text: 'OK to pay?',
    language: 'en-IN',
    card: JSON.stringify({ kind: 'spend_above_threshold', buttons: ['Approve', 'Hold'] }),
  },
}
const wait = {
  name: 'wait_for_reply',
  args: { from: 'rp', wait_seconds: 180, what_for: 'approve the refill' },
}

/** An agent that asks Arun and waits on him, then stops. */
function setUp() {
  const env = testApp()
  const replies: ModelReply[] = [{ text: '', toolCalls: [decision, card, wait] }]
  let i = 0
  const agent = new Agent(env.rt, {
    provider: { label: 'test', run: async () => replies[i++] ?? { text: 'done', toolCalls: [] } },
    tools: () => buildTools(env.rt),
    declarations,
    operator: env.operator,
    systemPrompt: () => 'system',
    guards: defaultGuards(),
  })
  deliverInput(env.rt, { kind: 'test', source: 'waits' })
  return { ...env, agent }
}

const waitResult = (rt: ReturnType<typeof setUp>['rt']) => {
  const tool = rt.history.all().find((t) => t.role === 'tool')
  return tool?.role === 'tool' ? tool.results[2]?.result : undefined
}
const tick = () => new Promise((r) => setTimeout(r, 30))

describe('a wait ends on a reply, a no-answer or the clock, nothing else', () => {
  it('holds while wall time passes, with nobody deciding for the person', async () => {
    const { rt, agent } = setUp()
    await tick()
    await tick()
    expect(agent.isRunning()).toBe(true)
    expect(rt.waits.open()).toMatchObject([
      { member: 'rp', what_for: 'approve the refill', deadline: '2026-10-06T03:45:00.000Z' },
    ])
    expect(rt.syncState().waits).toHaveLength(1)
    rt.waits.releaseAll('session_reset')
    await agent.settled()
  })

  it('ends on the person tapping the card, which locks the answer on it', async () => {
    const { rt, app, agent } = setUp()
    await tick()
    const [message] = rt.threads.thread('rp')
    const res = await request(app)
      .post('/api/reply')
      .set('X-Member-Id', 'rp')
      .send({ action: 'Approve', message_id: message!.id })
    expect(res.body).toEqual({ ok: true, delivered: true })
    await agent.settled()
    expect(waitResult(rt)).toMatchObject({ answered: true, from: 'rp', action: 'Approve' })
    expect(rt.threads.find(message!.id)).toMatchObject({ answer: 'Approve' })
    expect(rt.waits.open()).toEqual([])
  })

  it('takes a typed message in their own thread as their reply, not as a new input', async () => {
    const { rt, app, agent } = setUp()
    await tick()
    const res = await request(app).post('/api/input').set('X-Member-Id', 'rp').send({ text: 'Yes, go ahead' })
    expect(res.body.as).toBe('reply')
    await agent.settled()
    expect(waitResult(rt)).toMatchObject({ answered: true, text: 'Yes, go ahead' })
    expect(rt.history.all().filter((t) => t.role === 'user')).toHaveLength(1)
  })

  it('ends on somebody saying nobody answered, and the open card says so', async () => {
    const { rt, app, agent } = setUp()
    await tick()
    await request(app).post('/api/no-answer').send({ from: 'rp' })
    await agent.settled()
    expect(waitResult(rt)).toMatchObject({ answered: false, reason: 'no_answer' })
    expect(rt.threads.thread('rp')[0]?.timed_out_at).toBeTruthy()
    expect(rt.log.since().some((e) => e.type === 'card_timed_out')).toBe(true)
  })

  it('ends when the sim clock passes the deadline, and not before', async () => {
    const { rt, app, agent } = setUp()
    await tick()
    await request(app).post('/api/clock').send({ to: '2026-10-06T09:14:00+05:30', source: 'test' })
    expect(rt.waits.open()).toHaveLength(1)
    await request(app).post('/api/clock').send({ to: '2026-10-06T09:15:00+05:30', source: 'test' })
    await agent.settled()
    expect(waitResult(rt)).toMatchObject({ answered: false, reason: 'wait_time_elapsed' })
  })

  it('is not ended by a reply from somebody else', async () => {
    const { rt, app, agent } = setUp()
    await tick()
    const res = await request(app)
      .post('/api/reply')
      .set('X-Member-Id', 'member_3')
      .send({ text: 'I can pay' })
    expect(res.body.delivered).toBe(false)
    expect(rt.waits.open()).toHaveLength(1)
    rt.waits.releaseAll('session_reset')
    await agent.settled()
  })

  it('refuses a card answered by somebody it was not sent to, or answered twice', async () => {
    const { rt, app, agent } = setUp()
    await tick()
    const [message] = rt.threads.thread('rp')
    expect(
      (
        await request(app)
          .post('/api/reply')
          .set('X-Member-Id', 'patient')
          .send({ action: 'Approve', message_id: message!.id })
      ).status,
    ).toBe(404)
    await request(app)
      .post('/api/reply')
      .set('X-Member-Id', 'rp')
      .send({ action: 'Hold', message_id: message!.id })
    expect(
      (
        await request(app)
          .post('/api/reply')
          .set('X-Member-Id', 'rp')
          .send({ action: 'Approve', message_id: message!.id })
      ).status,
    ).toBe(409)
    await agent.settled()
  })

  it('lets go on a reset', async () => {
    const { rt, app, agent } = setUp()
    await tick()
    await request(app).post('/api/reset').send({})
    await agent.settled()
    expect(rt.waits.open()).toEqual([])
  })

  it('marks a wait left behind by a server that stopped, so nobody is waited on for ever', async () => {
    const path = join(mkdtempSync(join(tmpdir(), 'waits-')), 'session.sqlite')
    const first = createRuntime({ databasePath: path, loadOnboarding: () => loadOnboarding() })
    void first.waits.wait('rp', 180, 'approve the refill')
    first.db.close()

    const second = createRuntime({ databasePath: path, loadOnboarding: () => loadOnboarding() })
    expect(second.waits.open()).toHaveLength(1)
    second.waits.releaseAll('server_restarted')
    expect(second.waits.open()).toEqual([])
    expect(second.log.since().at(-1)).toMatchObject({
      type: 'reply_settled',
      result: { reason: 'server_restarted' },
    })
  })
})
