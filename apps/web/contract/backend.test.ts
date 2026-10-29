import type { ThreadMessage } from '@family-health/shared'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { ApiError, createApi } from '../src/api/client.js'
import { readEvent, type StreamEvent } from '../src/api/events.js'
import { SseParser } from '../src/api/sse.js'
import { LiveStream } from '../src/api/stream.js'

const base = inject('backend')
const as = (member: string | null) =>
  createApi({ base, headers: () => (member ? { 'X-Member-Id': member } : {}) })

/** The dev routes a person at the operator page uses. Never called from the member UI. */
async function dev(path: string, body: unknown = {}, method = 'POST') {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
  })
  return res.json() as Promise<Record<string, unknown>>
}

const seen: StreamEvent[] = []
/** Data lines the client could not read as a known event. */
const unknown: string[] = []
let stream: LiveStream

async function until<T>(find: () => T | undefined, what: string): Promise<T> {
  for (let i = 0; i < 200; i++) {
    const found = find()
    if (found !== undefined) return found
    await new Promise((r) => setTimeout(r, 25))
  }
  throw new Error(`timed out waiting for ${what}`)
}

const pendingCall = async () => {
  for (let i = 0; i < 200; i++) {
    const { pending } = (await dev('/api/operator/queue', undefined, 'GET')) as { pending: { id: string }[] }
    if (pending[0]) return pending[0]
    await new Promise((r) => setTimeout(r, 25))
  }
  throw new Error('no call reached the operator queue')
}

beforeAll(async () => {
  await dev('/api/reset', { reason: 'contract checks' })
  // Tee the stream so every raw data line can be checked against the client's event types.
  const spy: typeof fetch = async (url, init) => {
    const res = await fetch(url, init)
    if (!res.body) return res
    const [mine, copy] = res.body.tee()
    void (async () => {
      const reader = copy.getReader()
      const decoder = new TextDecoder()
      const parser = new SseParser()
      try {
        for (;;) {
          const { value, done } = await reader.read()
          if (done) break
          for (const frame of parser.feed(decoder.decode(value, { stream: true })))
            if (readEvent(frame.data) === null) unknown.push(frame.data.slice(0, 120))
        }
      } catch {
        // The connection closed.
      }
    })()
    return new Response(mine, { status: res.status, headers: res.headers })
  }
  stream = new LiveStream({ base, fetch: spy, backoff: [50] })
  stream.on((e) => seen.push(e))
  stream.start()
  await until(() => seen.find((e) => e.type === 'sync'), 'sync')
})

afterAll(() => stream.stop())

describe('reading the family', () => {
  it('lists the three members with roles and languages, and no phone numbers', async () => {
    const { members } = await as(null).members()
    expect(members).toEqual([
      { id: 'patient', name: 'Lakshmi', role: 'patient', language: 'te-IN' },
      { id: 'rp', name: 'Arun', role: 'responsible_person', language: 'en-IN' },
      { id: 'member_3', name: 'Kavya', role: 'family', language: 'en-IN' },
    ])
  })

  it('gives Lakshmi her Metoprolol at 3 days and her BP check overdue', async () => {
    const home = await as('patient').home('patient')
    expect(home.shared).toBe('full')
    expect(home.medicines.find((m) => m.name === 'Metoprolol')).toMatchObject({
      days_of_cover: 3,
      unit: 'pills',
    })
    const bp = home.tests.find((t) => t.name === 'BP check')
    expect(bp?.overdue).toBe(true)
    expect(bp?.days_until_due).toBeLessThan(0)
    expect(home.latest_agent_word).toBeNull()
  })

  it('gives Kavya status only on her mother, and Arun the full record', async () => {
    expect(await as('member_3').home('patient')).toMatchObject({
      shared: 'status_only',
      medicines: [],
      tests: [],
    })
    expect((await as('rp').home('patient')).medicines.length).toBeGreaterThan(0)
  })

  it('refuses a request that names nobody, in words', async () => {
    const err = await as(null)
      .home('patient')
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ kind: 'refused', status: 400 })
    expect((err as ApiError).reason).toMatch(/X-Member-Id is required/)
  })
})

describe('the stream', () => {
  it('opens with sync carrying the clock, the stage and the generation', () => {
    const sync = seen.find((e) => e.type === 'sync')
    expect(sync).toMatchObject({ stage: 1, clock: '2026-10-06T03:42:00.000Z' })
    expect(typeof (sync as { generation: number }).generation).toBe('number')
  })

  it('carries a family chat line to every client, with the chat it belongs to', async () => {
    const sent = await as('member_3').chatSend({ chat_id: 'rp', text: 'Contract: a direct line' })
    expect(sent.key).toBe('dm:member_3:rp')
    const line = await until(
      () => seen.find((e) => e.type === 'chat_message' && e.message.id === sent.message.id),
      'the chat line on the stream',
    )
    expect(line).toMatchObject({ key: 'dm:member_3:rp', message: { from: 'member_3', to_agent: false } })
  })
})

describe('the default take, as far as the backend goes today', () => {
  let card: ThreadMessage

  it('reaches Arun with a card after two chemists are called', async () => {
    await dev('/api/clock', { to_next_date: true, source: 'contract: the refill check' })
    const first = await pendingCall()
    await dev(`/api/operator/queue/${first.id}`, { variant: 'chemist_substitute_only' })
    const second = await pendingCall()
    await dev(`/api/operator/queue/${second.id}`, { variant: 'chemist_in_stock_kazipet' })
    const event = await until(
      () => seen.find((e) => e.type === 'message' && e.message.thread === 'rp' && e.message.card !== null),
      "Arun's card",
    )
    card = (event as { message: ThreadMessage }).message
    expect(card).toMatchObject({ from: 'agent', to: 'rp', answer: null, timed_out_at: null })
    expect(card.card).toMatchObject({ kind: 'spend_above_threshold', payee: 'Kazipet Pharmacy' })
    await until(() => seen.find((e) => e.type === 'awaiting_reply' && e.from === 'rp'), 'the wait on Arun')
  })

  it('refuses the card to anybody but Arun', async () => {
    const err = await as('patient')
      .reply({ message_id: card.id, action: 'Approve' })
      .catch((e: unknown) => e)
    expect(err).toMatchObject({ kind: 'refused', status: 404 })
  })

  it('takes Arun tapping the card once, locks it, and ends the wait', async () => {
    const res = await as('rp').reply({ message_id: card.id, action: 'Approve' })
    expect(res).toEqual({ ok: true, delivered: true })
    await until(
      () => seen.find((e) => e.type === 'card_answered' && e.message_id === card.id),
      'card_answered',
    )
    const settled = await until(
      () => seen.find((e) => e.type === 'reply_settled' && e.from === 'rp'),
      'reply_settled',
    )
    expect(settled).toMatchObject({ result: { answered: true, action: 'Approve' } })
  })

  it('refuses a second tap with the server reason', async () => {
    const err = await as('rp')
      .reply({ message_id: card.id, action: 'Approve' })
      .catch((e: unknown) => e)
    expect(err).toMatchObject({ kind: 'refused', status: 409, reason: 'that card is already answered' })
  })

  it('then tells Lakshmi in Telugu', async () => {
    const telugu = await until(
      () =>
        seen.find(
          (e) => e.type === 'message' && e.message.thread === 'patient' && e.message.from === 'agent',
        ),
      "the agent's message to Lakshmi",
    )
    expect((telugu as { message: ThreadMessage }).message.language).toBe('te-IN')
  })
})

describe('typing, forwarding and chat rules', () => {
  it('routes a typed line itself: an input when nothing waits on the person', async () => {
    expect(await as('member_3').input({ text: 'Contract: is Amma all right?' })).toEqual({
      ok: true,
      as: 'input',
    })
  })

  it('forwards a seeded record by its chat and message id', async () => {
    expect(await as('rp').forward({ chat_id: 'patient', message_id: 'h2', note: 'contract' })).toEqual({
      ok: true,
    })
    const input = await until(
      () => seen.find((e) => e.type === 'input' && e.input.kind === 'forwarded_record'),
      'the forwarded record as an input',
    )
    expect(input).toMatchObject({ input: { from: 'rp' } })
  })

  it('refuses a forward of a record that is not there, and a chat with yourself', async () => {
    await expect(as('rp').forward({ chat_id: 'patient', message_id: 'nope' })).rejects.toMatchObject({
      status: 404,
    })
    await expect(as('rp').chatSend({ chat_id: 'rp', text: 'x' })).rejects.toMatchObject({
      status: 400,
      reason: 'a direct chat is with somebody else',
    })
  })
})

describe('what the stream carried', () => {
  it('was every one an event type the client knows', () => {
    expect(unknown).toEqual([])
    const types = new Set(seen.map((e) => e.type))
    for (const t of ['sync', 'clock', 'input', 'decision', 'message', 'awaiting_reply', 'card_answered'])
      expect(types.has(t as StreamEvent['type'])).toBe(true)
  })

  it('ends a run on reset, and a reconnecting client lands in the new generation', async () => {
    const before = seen.filter((e) => e.type === 'sync').at(-1) as { generation: number }
    await dev('/api/reset', { reason: 'contract: new run' })
    await until(
      () => seen.find((e) => e.type === 'reset' && e.reason === 'contract: new run'),
      'the reset event',
    )
    const late = new LiveStream({ base, backoff: [50] })
    const lateSeen: StreamEvent[] = []
    late.on((e) => lateSeen.push(e))
    late.start()
    const sync = (await until(() => lateSeen.find((e) => e.type === 'sync'), 'a late sync')) as {
      generation: number
    }
    late.stop()
    expect(sync.generation).toBe(before.generation + 1)
    expect(lateSeen.map((e) => e.type)).toEqual(['reset', 'sync'])
  })
})
