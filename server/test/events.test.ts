import { afterEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { testRuntime } from './helpers.js'
import { listen, openStream } from './sse.js'

const closers: (() => unknown)[] = []
afterEach(async () => {
  for (const close of closers.splice(0)) await close()
})

async function setUp() {
  const rt = testRuntime()
  const { server, base } = await listen(createApp(rt))
  closers.push(() => new Promise((r) => server.close(r)))
  const stream = (headers?: Record<string, string>) => {
    const s = openStream(base, headers)
    closers.unshift(() => s.close())
    return s
  }
  return { rt, stream }
}

const types = (events: { type: string }[]) => events.map((e) => e.type)

describe('the event stream', () => {
  it('gives two clients the same events in the same order', async () => {
    const { rt, stream } = await setUp()
    const a = stream()
    const b = stream()
    await a.until((e) => e.some((x) => x.type === 'sync'))
    await b.until((e) => e.some((x) => x.type === 'sync'))

    for (let i = 0; i < 20; i++) rt.emit(i % 2 ? 'message' : 'stage', { i })
    await a.until((e) => e.length >= 21)
    await b.until((e) => e.length >= 21)

    const seqs = (events: { type: string; seq?: number }[]) =>
      events.filter((e) => e.type !== 'sync').map((e) => e.seq)
    expect(seqs(a.events)).toEqual(seqs(b.events))
    expect(seqs(a.events)).toHaveLength(20)
  })

  it('replays what a late client missed, then says what is true now', async () => {
    const { rt, stream } = await setUp()
    rt.emit('stage', { stage: 2 })
    rt.emit('message', { text: 'earlier' })

    const late = stream()
    await late.until((e) => e.some((x) => x.type === 'sync'))
    expect(types(late.events)).toEqual(['stage', 'message', 'sync'])
    expect(late.events[2]).toMatchObject({ clock: '2026-10-06T03:42:00.000Z', stage: 1, generation: 1 })
  })

  it('picks up after the last event a reconnecting client saw', async () => {
    const { rt, stream } = await setUp()
    const first = rt.emit('stage', { stage: 2 })
    rt.emit('message', { text: 'missed' })

    const back = stream({ 'Last-Event-ID': String(first.seq) })
    await back.until((e) => e.some((x) => x.type === 'sync'))
    expect(types(back.events)).toEqual(['message', 'sync'])
  })

  it('stops sending to a client that has gone', async () => {
    const { rt, stream } = await setUp()
    const s = stream()
    await s.until((e) => e.some((x) => x.type === 'sync'))
    expect(rt.bus.size).toBe(1)
    await s.close()
    await new Promise((r) => setTimeout(r, 50))
    expect(rt.bus.size).toBe(0)
  })
})
