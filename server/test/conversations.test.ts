import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { testApp, testRuntime } from './helpers.js'

function setUp() {
  const rt = testRuntime()
  return { rt, app: testApp(rt).app }
}

describe('the agent thread', () => {
  it("keeps the agent's message and the person's reply in that person's thread, card and all", () => {
    const { rt } = setUp()
    const card = rt.threads.post({
      thread: 'rp',
      from: 'agent',
      to: 'rp',
      text: 'OK to go ahead?',
      language: 'en-IN',
      card: { kind: 'test_due', buttons: ['Go ahead', 'Not now'] },
    })
    rt.threads.post({ thread: 'rp', from: 'rp', to: 'agent', text: 'Go ahead' })
    expect(rt.threads.thread('rp').map((m) => [m.from, m.text])).toEqual([
      ['agent', 'OK to go ahead?'],
      ['rp', 'Go ahead'],
    ])
    expect(rt.threads.answerCard(card.id, 'Go ahead')?.answer).toBe('Go ahead')
    expect(rt.threads.answerCard(card.id, 'Not now')).toBeNull()
    expect(rt.log.since().map((e) => e.type)).toEqual(['message', 'message', 'card_answered'])
  })
})

describe('family chats', () => {
  it('stores a direct chat under the pair, so both handsets see one thread', async () => {
    const { rt, app } = setUp()
    const a = await request(app)
      .post('/api/chat/send')
      .set('X-Member-Id', 'rp')
      .send({ chat_id: 'patient', text: 'Amma, did you eat?' })
    const b = await request(app)
      .post('/api/chat/send')
      .set('X-Member-Id', 'patient')
      .send({ chat_id: 'rp', text: 'Yes' })
    expect(a.body.key).toBe('dm:patient:rp')
    expect(b.body.key).toBe('dm:patient:rp')
    expect(rt.chats.chat('dm:patient:rp').map((m) => m.text)).toEqual(['Amma, did you eat?', 'Yes'])
  })

  it('keeps the group under its own id and sends each line out on the stream', async () => {
    const { rt, app } = setUp()
    await request(app)
      .post('/api/chat/send')
      .set('X-Member-Id', 'member_3')
      .send({ chat_id: 'family_group', text: 'Calling Amma tonight' })
    expect(rt.log.since().at(-1)).toMatchObject({ type: 'chat_message', key: 'family_group' })
  })

  it('refuses a stranger, a chat that does not exist, a chat with yourself, and @agent outside the group', async () => {
    const { app } = setUp()
    const send = (who: string | null, body: object) => {
      const r = request(app).post('/api/chat/send')
      return (who ? r.set('X-Member-Id', who) : r).send(body)
    }
    expect((await send(null, { chat_id: 'rp', text: 'hi' })).status).toBe(400)
    expect((await send('uncle', { chat_id: 'rp', text: 'hi' })).status).toBe(400)
    expect((await send('rp', { chat_id: 'neighbours', text: 'hi' })).status).toBe(400)
    expect((await send('rp', { chat_id: 'rp', text: 'hi' })).status).toBe(400)
    expect((await send('rp', { chat_id: 'patient', text: 'hi', ask_agent: true })).status).toBe(400)
  })

  it('is emptied by a reset', async () => {
    const { rt, app } = setUp()
    await request(app)
      .post('/api/chat/send')
      .set('X-Member-Id', 'rp')
      .send({ chat_id: 'patient', text: 'hi' })
    rt.threads.post({ thread: 'rp', from: 'agent', to: 'rp', text: 'hello' })
    await request(app).post('/api/reset').send({})
    expect(rt.chats.chat('dm:patient:rp')).toEqual([])
    expect(rt.threads.thread('rp')).toEqual([])
  })
})
