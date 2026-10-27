import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { deliverInput } from '../src/agent/inbox.js'
import { Agent } from '../src/agent/loop.js'
import type { ModelProvider, ModelReply, ModelRequest } from '../src/agent/providers/types.js'
import { defineTool } from '../src/agent/tool.js'
import { testApp } from './helpers.js'

/** A provider that plays back replies and records what it was shown. */
function scripted(replies: (ModelReply | ((req: ModelRequest) => ModelReply | Promise<ModelReply>))[]) {
  const seen: ModelRequest[] = []
  let i = 0
  const provider: ModelProvider = {
    label: 'test script',
    async run(req) {
      seen.push(structuredClone(req))
      const next = replies[i++]
      if (!next) return { text: 'done', toolCalls: [] }
      return typeof next === 'function' ? next(req) : next
    },
  }
  return { provider, seen }
}

const note = defineTool({
  name: 'note',
  description: 'Write something down',
  mode: 'LIVE',
  schema: z.object({ text: z.string() }),
  handler: ({ text }) => ({ ok: true, noted: text }),
})
const ring = defineTool({
  name: 'ring',
  description: 'A call a person answers',
  mode: 'PERSON',
  schema: z.object({ to: z.string() }),
  fixtures: 'phone/place_call',
})
const look_up = defineTool({
  name: 'look_up',
  description: 'Answered from a fixture',
  mode: 'FIXTURE',
  schema: z.object({ q: z.string() }),
  fixtures: 'phone/place_call',
})

function setUp(replies: Parameters<typeof scripted>[0], opts: { auto?: boolean; maxSteps?: number } = {}) {
  const { rt, operator, app } = testApp(undefined, opts.auto ?? false)
  const { provider, seen } = scripted(replies)
  const agent = new Agent(rt, {
    provider,
    tools: () => [note, ring, look_up] as never,
    operator,
    systemPrompt: () => 'system',
    declarations: () => [],
    ...(opts.maxSteps ? { maxSteps: opts.maxSteps } : {}),
  })
  return { rt, operator, app, agent, seen }
}

const call = (name: string, args: object, id?: string) => ({
  name,
  args: args as Record<string, unknown>,
  ...(id ? { id } : {}),
})
const types = (rt: ReturnType<typeof testApp>['rt']) => rt.log.since().map((e) => e.type)

describe('the agent loop', () => {
  it('runs tool calls and feeds the results back until the model stops', async () => {
    const { rt, agent, seen } = setUp([{ text: '', toolCalls: [call('note', { text: 'first' })] }])
    deliverInput(rt, { kind: 'message', source: 'test', text: 'hello' })
    await agent.settled()

    expect(rt.history.all().map((t) => t.role)).toEqual(['user', 'model', 'tool', 'model'])
    const tool = rt.history.all()[2]
    expect(tool?.role === 'tool' && tool.results[0]?.result).toEqual({ ok: true, noted: 'first' })
    expect(seen).toHaveLength(2)
    expect(types(rt)).toEqual([
      'input',
      'thinking',
      'model_step',
      'tool_call',
      'tool_result',
      'thinking',
      'model_step',
      'idle',
    ])
  })

  it('mints an id for a call that came without one', async () => {
    const { rt, agent } = setUp([{ text: '', toolCalls: [call('note', { text: 'x' })] }])
    deliverInput(rt, { kind: 'message', source: 'test' })
    await agent.settled()
    const model = rt.history.all()[1]
    expect(model?.role === 'model' && model.toolCalls[0]?.id).toMatch(/[0-9a-f-]{36}/)
  })

  it('stops at thirty steps and says so', async () => {
    const forever = Array.from({ length: 40 }, () => ({
      text: '',
      toolCalls: [call('note', { text: 'again' })],
    }))
    const { rt, agent, seen } = setUp(forever)
    deliverInput(rt, { kind: 'message', source: 'test' })
    await agent.settled()
    expect(seen).toHaveLength(30)
    expect(rt.log.since().at(-1)).toMatchObject({
      type: 'error',
      error: 'stopped after 30 steps without settling',
    })
  })

  it('answers an unknown tool, or arguments that do not fit, with an error the model reads', async () => {
    const { rt, agent } = setUp([{ text: '', toolCalls: [call('fly', {}), call('note', { text: 7 })] }])
    deliverInput(rt, { kind: 'message', source: 'test' })
    await agent.settled()
    const tool = rt.history.all()[2]
    if (tool?.role !== 'tool') throw new Error('expected results')
    expect(tool.results[0]?.result).toEqual({ ok: false, error: 'there is no tool called fly' })
    expect(tool.results[1]?.result).toMatchObject({
      ok: false,
      error: expect.stringMatching(/do not fit note: text/),
    })
  })

  it('waits on a person for a PERSON call, with no timeout, and carries on with their answer', async () => {
    const { rt, agent, operator, app } = setUp([
      { text: '', toolCalls: [call('ring', { to: 'Kazipet Pharmacy' })] },
    ])
    deliverInput(rt, { kind: 'message', source: 'test' })
    await new Promise((r) => setTimeout(r, 30))
    const [item] = operator.pending()
    expect(item).toMatchObject({ tool: 'ring', mode: 'PERSON', request: { to: 'Kazipet Pharmacy' } })
    expect(agent.isRunning()).toBe(true)

    const res = await request(app)
      .post(`/api/operator/queue/${item!.id}`)
      .send({ variant: 'answered', response: { who: 'chemist', said: 'Yes, in stock' } })
    expect(res.status).toBe(200)
    await agent.settled()
    const tool = rt.history.all()[2]
    expect(tool?.role === 'tool' && tool.results[0]?.result).toMatchObject({
      outcome: 'ANSWERED',
      who: 'chemist',
      said: 'Yes, in stock',
    })
  })

  it('answers a FIXTURE call from its file when OPERATOR_AUTO is on, and never a PERSON call', async () => {
    const { rt, agent, operator } = setUp(
      [
        { text: '', toolCalls: [call('look_up', { q: 'x' })] },
        { text: '', toolCalls: [call('ring', { to: 'x' })] },
      ],
      { auto: true },
    )
    deliverInput(rt, { kind: 'message', source: 'test' })
    await new Promise((r) => setTimeout(r, 30))
    expect(rt.log.since().find((e) => e.type === 'operator_resolved')).toMatchObject({ via: 'auto' })
    expect(operator.pending().map((i) => i.tool)).toEqual(['ring'])
    operator.abandonAll('test over')
    await agent.settled()
  })

  it('refuses a fixture answer that is not on file, or one somebody edited', async () => {
    const { rt, agent, operator, app } = setUp([{ text: '', toolCalls: [call('look_up', { q: 'x' })] }])
    deliverInput(rt, { kind: 'message', source: 'test' })
    await new Promise((r) => setTimeout(r, 30))
    const [item] = operator.pending()
    const post = (body: object) => request(app).post(`/api/operator/queue/${item!.id}`).send(body)
    expect((await post({ variant: 'invented' })).status).toBe(400)
    expect((await post({ variant: 'busy', response: { said: 'edited' } })).status).toBe(400)
    expect((await post({ variant: 'busy' })).status).toBe(200)
    expect((await post({ variant: 'busy' })).status).toBe(409)
    await agent.settled()
  })

  it('holds an input that arrives mid-step until that step has its results', async () => {
    const { rt, agent, operator } = setUp([{ text: '', toolCalls: [call('ring', { to: 'x' })] }])
    deliverInput(rt, { kind: 'message', source: 'test', text: 'first' })
    await new Promise((r) => setTimeout(r, 30))
    deliverInput(rt, { kind: 'message', source: 'test', text: 'second, mid-step' })
    expect(rt.history.all().map((t) => t.role)).toEqual(['user', 'model'])

    operator.respond(operator.pending()[0]!.id, { variant: 'no_answer' })
    await agent.settled()
    expect(rt.history.all().map((t) => t.role)).toEqual(['user', 'model', 'tool', 'user', 'model'])
  })

  it('stops a run when the session is reset, and lets go of the call it was waiting on', async () => {
    const { rt, agent, app, seen } = setUp([
      { text: '', toolCalls: [call('ring', { to: 'x' })] },
      { text: '', toolCalls: [call('note', { text: 'never' })] },
    ])
    deliverInput(rt, { kind: 'message', source: 'test' })
    await new Promise((r) => setTimeout(r, 30))
    await request(app).post('/api/reset').send({})
    await agent.settled()
    expect(seen).toHaveLength(1)
    expect(rt.history.all()).toEqual([])
    expect(rt.log.since().map((e) => e.type)).toEqual(['reset'])
  })

  it('wakes on a member message in their own thread and on a date the clock reaches', async () => {
    const { rt, agent, app, seen } = setUp([])
    await request(app).post('/api/input').set('X-Member-Id', 'rp').send({ text: 'Is Amma okay?' })
    await agent.settled()
    expect(rt.threads.thread('rp').map((m) => m.text)).toEqual(['Is Amma okay?'])
    await request(app).post('/api/clock').send({ to_next_date: true, source: 'next refill date' })
    await agent.settled()
    expect(seen).toHaveLength(2)
    expect(JSON.stringify(seen[1]!.history.at(-1))).toMatch(/medicine_runs_out/)
  })

  it('gives a call cut off by a restart a result saying so', () => {
    const { rt } = setUp([])
    rt.history.append({ role: 'user', text: 'x' })
    rt.history.append({ role: 'model', text: '', toolCalls: [{ id: 'c1', name: 'ring', args: {} }] })
    expect(rt.history.closeInterruptedStep()).toBe(1)
    expect(rt.history.all().at(-1)).toMatchObject({
      role: 'tool',
      results: [{ id: 'c1', result: { ok: false } }],
    })
    expect(rt.history.closeInterruptedStep()).toBe(0)
  })
})
