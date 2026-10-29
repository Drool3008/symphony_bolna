import { afterEach, describe, expect, it, vi } from 'vitest'
import { readEvent, type StreamEvent } from './events.js'
import { LiveStream } from './stream.js'

/** A fetch that answers each call with the next script of chunks, then ends the body. */
function scripted(...connections: string[][]) {
  const calls: { url: string; headers: Record<string, string> }[] = []
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, headers: (init?.headers ?? {}) as Record<string, string> })
    const chunks = connections.shift()
    if (!chunks) return new Promise<Response>(() => {})
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const c of chunks) controller.enqueue(new TextEncoder().encode(c))
        controller.close()
      },
    })
    return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
  })
  return { fetch: fetch as unknown as typeof globalThis.fetch, calls }
}

const ev = (seq: number, type = 'clock') =>
  `id: ${seq}\ndata: ${JSON.stringify({ seq, type, at: 'a', clock: 'c', source: 's', reached: [] })}\n\n`
const sync = `data: ${JSON.stringify({ type: 'sync', at: 'a', clock: 'c', stage: 1, generation: 1 })}\n\n`

let stream: LiveStream | null = null
afterEach(() => stream?.stop())

const until = async (check: () => boolean) => {
  for (let i = 0; i < 100 && !check(); i++) await new Promise((r) => setTimeout(r, 5))
}

describe('the live stream', () => {
  it('delivers replayed events, then sync, and goes live', async () => {
    const { fetch } = scripted([ev(1), ev(2) + sync])
    stream = new LiveStream({ base: '', fetch, backoff: [10_000] })
    const seen: StreamEvent[] = []
    const statuses: string[] = []
    stream.on((e) => seen.push(e))
    stream.onStatus((s) => statuses.push(s))
    stream.start()
    await until(() => seen.length === 3)
    expect(seen.map((e) => e.type)).toEqual(['clock', 'clock', 'sync'])
    expect(statuses).toContain('live')
    expect(stream.lastId).toBe(2)
  })

  it('resumes after a drop from the last event it saw', async () => {
    const { fetch, calls } = scripted([ev(1), ev(2) + sync], [ev(3) + sync])
    stream = new LiveStream({ base: '', fetch, backoff: [5] })
    const seen: number[] = []
    stream.on((e) => {
      if (e.type !== 'sync') seen.push(e.seq)
    })
    stream.start()
    await until(() => seen.length === 3)
    expect(seen).toEqual([1, 2, 3])
    expect(calls[0]?.url).toBe('/events')
    expect(calls[1]?.url).toBe('/events?since=2')
    expect(calls[1]?.headers['Last-Event-ID']).toBe('2')
  })

  it('backs off further each time a connection fails before going live', async () => {
    vi.useFakeTimers()
    try {
      const fetch = vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }) as unknown as typeof globalThis.fetch
      stream = new LiveStream({ base: '', fetch, backoff: [100, 200, 400] })
      stream.start()
      await vi.advanceTimersByTimeAsync(0)
      expect(fetch).toHaveBeenCalledTimes(1)
      expect(stream.status).toBe('offline')
      await vi.advanceTimersByTimeAsync(100)
      expect(fetch).toHaveBeenCalledTimes(2)
      await vi.advanceTimersByTimeAsync(199)
      expect(fetch).toHaveBeenCalledTimes(2)
      await vi.advanceTimersByTimeAsync(1)
      expect(fetch).toHaveBeenCalledTimes(3)
    } finally {
      stream?.stop()
      vi.useRealTimers()
    }
  })

  it('ignores an event type it does not know', () => {
    expect(readEvent(JSON.stringify({ seq: 9, type: 'something_new', at: 'a', clock: 'c' }))).toBeNull()
    expect(readEvent('not json')).toBeNull()
  })
})
