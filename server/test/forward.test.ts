import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { testApp, testRuntime } from './helpers.js'

function setUp() {
  const rt = testRuntime()
  return { rt, app: testApp(rt).app }
}

/** Everything the model could read: its history, turn by turn. */
const modelCanRead = (rt: ReturnType<typeof testRuntime>) => JSON.stringify(rt.history.all())

describe('R2: forwarding is the only door to the agent', () => {
  it('never puts a family chat line where the model can read it', async () => {
    const { rt, app } = setUp()
    for (const [who, chat] of [
      ['rp', 'patient'],
      ['patient', 'rp'],
      ['member_3', 'family_group'],
    ] as const) {
      await request(app)
        .post('/api/chat/send')
        .set('X-Member-Id', who)
        .send({ chat_id: chat, text: `private line from ${who}` })
    }
    expect(rt.history.all()).toEqual([])
    expect(modelCanRead(rt)).not.toMatch(/private line/)
  })

  it('lets one @agent line in the group through, labelled with who sent it and where', async () => {
    const { rt, app } = setUp()
    await request(app)
      .post('/api/chat/send')
      .set('X-Member-Id', 'member_3')
      .send({ chat_id: 'family_group', text: 'not for the agent' })
    await request(app)
      .post('/api/chat/send')
      .set('X-Member-Id', 'member_3')
      .send({ chat_id: 'family_group', text: 'Amma sounds breathless', ask_agent: true })
    const turns = rt.history.all()
    expect(turns).toHaveLength(1)
    expect(modelCanRead(rt)).toMatch(/Kavya, in the family group, addressed to the agent/)
    expect(modelCanRead(rt)).not.toMatch(/not for the agent/)
  })

  it('hands a forwarded photo to the model with its source and the forwarder caption as theirs', async () => {
    const { rt, app } = setUp()
    const res = await request(app)
      .post('/api/forward')
      .set('X-Member-Id', 'rp')
      .send({ chat_id: 'patient', message_id: 'h3', caption: 'New prescription' })
    expect(res.status).toBe(200)
    const [turn] = rt.history.all()
    expect(turn?.role).toBe('user')
    if (turn?.role !== 'user') return
    expect(turn.text).toMatch(/^Simulated clock: 2026-10-06T03:42:00.000Z/)
    expect(turn.text).toMatch(/Forwarded by Arun from Lakshmi · photo · original date 2026-07-02/)
    expect(turn.text).toMatch(/"caption_from_forwarder": "New prescription"/)
    expect(turn.images?.[0]).toMatchObject({ mime: 'image/png', name: 'rx-patient.png' })
    expect(rt.log.since().at(-1)).toMatchObject({ type: 'input' })
  })

  it('sends a forwarded PDF as its page-1 image', async () => {
    const { rt, app } = setUp()
    await request(app)
      .post('/api/forward')
      .set('X-Member-Id', 'rp')
      .send({ chat_id: 'patient', message_id: 'h2' })
    const [turn] = rt.history.all()
    if (turn?.role !== 'user') throw new Error('expected a user turn')
    expect(turn.text).toMatch(/· PDF ·/)
    expect(turn.images?.[0]?.data.length).toBeGreaterThan(100)
  })

  it('refuses a message with no record, a message that does not exist, and an anonymous forward', async () => {
    const { app } = setUp()
    const fwd = (body: object, who: string | null = 'rp') => {
      const r = request(app).post('/api/forward')
      return (who ? r.set('X-Member-Id', who) : r).send(body)
    }
    expect((await fwd({ chat_id: 'patient', message_id: 'h1' })).status).toBe(400)
    expect((await fwd({ chat_id: 'patient', message_id: 'nope' })).status).toBe(404)
    expect((await fwd({ chat_id: 'patient', message_id: 'h3' }, null)).status).toBe(400)
  })

  it('wakes the agent for a real input, and only for one', async () => {
    const { rt, app } = setUp()
    let woken = 0
    rt.hooks.input.on(() => woken++)
    await request(app)
      .post('/api/chat/send')
      .set('X-Member-Id', 'rp')
      .send({ chat_id: 'patient', text: 'hi' })
    await request(app)
      .post('/api/forward')
      .set('X-Member-Id', 'rp')
      .send({ chat_id: 'patient', message_id: 'h3' })
    expect(woken).toBe(1)
  })
})
