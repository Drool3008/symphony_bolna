import { API_BASE, apiUrl } from './base.js'
import { readEvent, type StreamEvent } from './events.js'
import { SseParser } from './sse.js'

export type StreamStatus = 'connecting' | 'live' | 'offline'

export interface StreamOptions {
  base?: string
  fetch?: typeof fetch
  /** Headers each connection carries. /events reads none today (server/src/events.ts). */
  headers?: () => Record<string, string>
  /** Delays between tries after a drop, in ms; the last repeats. */
  backoff?: number[]
}

type Listener = (event: StreamEvent) => void
type StatusListener = (status: StreamStatus) => void

const DEFAULT_BACKOFF = [500, 1_000, 2_000, 5_000, 10_000, 30_000]

/**
 * The app's one connection to GET /events (brief, Section 4).
 *
 * Read with fetch and a stream reader rather than EventSource, so the app
 * controls the backoff and could send a header if the stream ever needs one.
 * On connect the server replays this generation's events after the last one
 * this client saw, then sends `sync`. The last event id is kept and sent as
 * Last-Event-ID (and ?since=) on every reconnect, so a drop loses nothing.
 */
export class LiveStream {
  private readonly listeners = new Set<Listener>()
  private readonly statusListeners = new Set<StatusListener>()
  private readonly base: string
  private readonly send: typeof fetch
  private readonly headers: () => Record<string, string>
  private readonly backoff: number[]
  private abort: AbortController | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private tries = 0
  private stopped = true
  private _status: StreamStatus = 'offline'
  /** The seq of the last logged event this client has seen. */
  lastId: number | null = null

  constructor({
    base = API_BASE,
    fetch: send = fetch,
    headers = () => ({}),
    backoff = DEFAULT_BACKOFF,
  }: StreamOptions = {}) {
    this.base = base
    this.send = send
    this.headers = headers
    this.backoff = backoff.length ? backoff : DEFAULT_BACKOFF
  }

  get status(): StreamStatus {
    return this._status
  }

  on(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  onStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener)
    return () => this.statusListeners.delete(listener)
  }

  start(): void {
    if (!this.stopped) return
    this.stopped = false
    void this.connect()
  }

  stop(): void {
    this.stopped = true
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    this.abort?.abort()
    this.abort = null
    this.setStatus('offline')
  }

  /** Forget the position, for a new run: the next connection replays the whole generation. */
  forgetPosition(): void {
    this.lastId = null
  }

  private setStatus(status: StreamStatus): void {
    if (status === this._status) return
    this._status = status
    for (const l of this.statusListeners) l(status)
  }

  private async connect(): Promise<void> {
    this.setStatus('connecting')
    const abort = new AbortController()
    this.abort = abort
    const since = this.lastId
    const path = since === null ? '/events' : `/events?since=${since}`
    try {
      const res = await this.send(apiUrl(path, this.base), {
        headers: {
          Accept: 'text/event-stream',
          ...(since === null ? {} : { 'Last-Event-ID': String(since) }),
          ...this.headers(),
        },
        signal: abort.signal,
        cache: 'no-store',
      })
      if (!res.ok || !res.body) throw new Error(`the stream answered ${res.status}`)
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      const parser = new SseParser()
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        for (const frame of parser.feed(decoder.decode(value, { stream: true })))
          this.deliver(frame.id, frame.data)
      }
    } catch {
      // A drop, a refusal or an abort; the retry below decides what follows.
    }
    if (this.abort === abort) this.abort = null
    if (this.stopped) return
    this.setStatus('offline')
    const delay = this.backoff[Math.min(this.tries, this.backoff.length - 1)] ?? 1_000
    this.tries += 1
    this.timer = setTimeout(() => {
      this.timer = null
      if (!this.stopped) void this.connect()
    }, delay)
  }

  private deliver(id: string | null, data: string): void {
    const event = readEvent(data)
    if (id !== null && Number.isFinite(Number(id))) this.lastId = Number(id)
    if (!event) return
    if (event.type === 'sync') {
      // The replay is over and the connection is live: a later drop starts the backoff again.
      this.tries = 0
      this.setStatus('live')
    }
    for (const l of this.listeners) l(event)
  }
}
