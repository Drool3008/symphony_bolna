import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import type { StreamEvent } from './events.js'
import { cardArrivalKey, connectLive, sessionKey, type SessionState } from './live.js'

function fakeStream() {
  const listeners = new Set<(e: StreamEvent) => void>()
  return {
    on(l: (e: StreamEvent) => void) {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    emit(e: StreamEvent) {
      for (const l of listeners) l(e)
    },
  }
}

const sync = (generation: number, clock = '2026-10-06T03:42:00.000Z'): StreamEvent => ({
  type: 'sync',
  at: 'a',
  clock,
  stage: 1,
  generation,
})

describe('the stream feeding the cache', () => {
  it('keeps the sim clock and stage from sync, clock and stage events', () => {
    const qc = new QueryClient()
    const stream = fakeStream()
    connectLive(stream, qc)
    stream.emit(sync(1))
    stream.emit({
      seq: 2,
      type: 'clock',
      at: 'a',
      clock: '2026-10-08T18:30:00.000Z',
      source: 's',
      reached: [],
    })
    stream.emit({ seq: 3, type: 'stage', at: 'a', clock: 'c', stage: 6, why: 'acting' })
    expect(qc.getQueryData<SessionState>(sessionKey)).toEqual({
      clock: '2026-10-08T18:30:00.000Z',
      stage: 6,
      generation: 1,
      thinking: false,
    })
  })

  it('says the agent is working from thinking until idle, and stops on an error or a reset', () => {
    const qc = new QueryClient()
    const stream = fakeStream()
    connectLive(stream, qc)
    const thinking = () => qc.getQueryData<SessionState>(sessionKey)?.thinking
    stream.emit(sync(1))
    expect(thinking()).toBe(false)
    stream.emit({ seq: 2, type: 'thinking', at: 'a', clock: 'c', step: 0 })
    expect(thinking()).toBe(true)
    stream.emit({ seq: 3, type: 'idle', at: 'a', clock: 'c', reason: 'the model made no tool calls' })
    expect(thinking()).toBe(false)
    stream.emit({ seq: 4, type: 'thinking', at: 'a', clock: 'c', step: 0 })
    stream.emit({ seq: 5, type: 'error', at: 'a', clock: 'c', error: 'provider down' })
    expect(thinking()).toBe(false)
    stream.emit({ seq: 6, type: 'thinking', at: 'a', clock: 'c', step: 0 })
    stream.emit({ seq: 7, type: 'reset', at: 'a', clock: 'c', reason: 'operator reset' })
    expect(thinking()).toBe(false)
  })

  it('takes a run already going on from sync, for a phone that connects mid-run', () => {
    const qc = new QueryClient()
    const stream = fakeStream()
    connectLive(stream, qc)
    stream.emit({ ...sync(1), running: true } as StreamEvent)
    expect(qc.getQueryData<SessionState>(sessionKey)?.thinking).toBe(true)
  })

  it('clears what every screen holds on a reset, and fetches again what is on screen', async () => {
    const qc = new QueryClient()
    const stream = fakeStream()
    connectLive(stream, qc)
    stream.emit(sync(1))
    const fetchHome = vi.fn(async () => ({ medicines: ['from the last run'] }))
    const observer = new QueryObserver(qc, { queryKey: ['home', 'patient'], queryFn: fetchHome })
    const off = observer.subscribe(() => {})
    await vi.waitFor(() => expect(fetchHome).toHaveBeenCalledTimes(1))
    qc.setQueryData(['thread', 'rp'], ['a message from the last run'])

    stream.emit({
      seq: 9,
      type: 'reset',
      at: 'a',
      clock: '2026-10-06T03:42:00.000Z',
      reason: 'operator reset',
    })

    expect(qc.getQueryData(['thread', 'rp'])).toBeUndefined()
    expect(qc.getQueryData<SessionState>(sessionKey)?.generation).toBe(2)
    await vi.waitFor(() => expect(fetchHome).toHaveBeenCalledTimes(2))
    off()
  })

  it('leaves alone what a fresh page fetched when the replay opens with the run’s own reset', () => {
    const qc = new QueryClient()
    const stream = fakeStream()
    connectLive(stream, qc)
    qc.setQueryData(['members'], ['fetched for this run'])
    stream.emit({
      seq: 1,
      type: 'reset',
      at: 'a',
      clock: '2026-10-06T03:42:00.000Z',
      reason: 'operator reset',
    })
    stream.emit(sync(4))
    expect(qc.getQueryData(['members'])).toEqual(['fetched for this run'])
    expect(qc.getQueryData<SessionState>(sessionKey)?.generation).toBe(4)
  })

  it('treats a sync from another generation as a new run, for a client that missed the reset', () => {
    const qc = new QueryClient()
    const stream = fakeStream()
    connectLive(stream, qc)
    stream.emit(sync(1))
    qc.setQueryData(['thread', 'patient'], ['stale'])
    stream.emit(sync(1))
    expect(qc.getQueryData(['thread', 'patient'])).toEqual(['stale'])
    stream.emit(sync(3))
    expect(qc.getQueryData(['thread', 'patient'])).toBeUndefined()
    expect(qc.getQueryData<SessionState>(sessionKey)?.generation).toBe(3)
  })
})

describe('a card arriving while the app is live', () => {
  const card = (id: string, fields: Record<string, unknown> = {}) => ({
    seq: 9,
    type: 'message' as const,
    at: 'a',
    clock: 'c',
    message: {
      id,
      thread: 'rp',
      from: 'agent',
      to: 'rp',
      text: 'OK to pay?',
      language: 'en-IN',
      kind: null,
      card: { kind: 'spend_above_threshold' },
      answer: null,
      answered_at: null,
      timed_out_at: null,
      at: 'c',
      ...fields,
    },
  })

  it('is noted for the shell, but not one from the replay before the first sync', () => {
    const qc = new QueryClient()
    const stream = fakeStream()
    connectLive(stream, qc, { memberId: () => 'rp' })
    stream.emit(card('old'))
    stream.emit(sync(1))
    expect(qc.getQueryData(cardArrivalKey('rp'))).toBeUndefined()
    stream.emit(card('new'))
    expect(qc.getQueryData(cardArrivalKey('rp'))).toBe('new')
  })

  it('is not noted when it is another member’s, a receipt, or one this phone already had', () => {
    const qc = new QueryClient()
    const stream = fakeStream()
    connectLive(stream, qc, { memberId: () => 'rp' })
    stream.emit(card('seen'))
    stream.emit(sync(1))
    stream.emit(card('seen'))
    stream.emit(card('lakshmis', { thread: 'patient', to: 'patient' }))
    stream.emit(card('receipt', { card: { kind: 'order_receipt' } }))
    expect(qc.getQueryData(cardArrivalKey('rp'))).toBeUndefined()
  })
})

describe('home follows the stream', () => {
  it('refetches the home of whoever the agent wrote to, and every home when the clock moves', async () => {
    const qc = new QueryClient()
    const stream = fakeStream()
    connectLive(stream, qc)
    stream.emit(sync(1))
    const patient = vi.fn(async () => ({ latest_agent_word: null }))
    const rp = vi.fn(async () => ({ latest_agent_word: null }))
    const offs = [
      new QueryObserver(qc, { queryKey: ['home', 'patient'], queryFn: patient }).subscribe(() => {}),
      new QueryObserver(qc, { queryKey: ['home', 'rp'], queryFn: rp }).subscribe(() => {}),
    ]
    await vi.waitFor(() => expect(patient).toHaveBeenCalledTimes(1))
    await vi.waitFor(() => expect(rp).toHaveBeenCalledTimes(1))
    const message = {
      id: 'm1',
      thread: 'patient',
      from: 'agent',
      to: 'patient',
      text: 't',
      language: 'te-IN',
      kind: null,
      card: null,
      answer: null,
      answered_at: null,
      timed_out_at: null,
      at: 'c',
    }
    stream.emit({ seq: 4, type: 'message', at: 'a', clock: 'c', message })
    await vi.waitFor(() => expect(patient).toHaveBeenCalledTimes(2))
    expect(rp).toHaveBeenCalledTimes(1)
    stream.emit({ seq: 5, type: 'clock', at: 'a', clock: 'c2', source: 's', reached: [] })
    await vi.waitFor(() => expect(rp).toHaveBeenCalledTimes(2))
    for (const off of offs) off()
  })
})
