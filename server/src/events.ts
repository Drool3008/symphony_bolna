import type { AgentEvent } from '@family-health/shared'
import type { Request, Response } from 'express'
import type { Runtime } from './runtime.js'

export type Listener = (event: AgentEvent) => void

/** Fans each logged event out to whoever is listening, in the order it was logged. */
export class EventBus {
  private readonly listeners = new Set<Listener>()

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  publish(event: AgentEvent): void {
    for (const listener of this.listeners) listener(event)
  }

  get size(): number {
    return this.listeners.size
  }
}

const KEEPALIVE_MS = 25_000

/**
 * GET /events. Server-Sent Events, as in the reference (server/index.js).
 *
 * A client that connects late, or reconnects, is replayed this generation's
 * events after the last one it saw (the Last-Event-ID header, which browsers
 * send on reconnect, or `?since=`), then sent one `sync` event saying what is
 * true right now. The replay and the subscription happen in the same tick, so
 * nothing logged in between can be missed. `sync` is addressed to this one
 * client and is not logged.
 */
export function streamEvents(rt: Runtime, req: Request, res: Response): void {
  const header = req.get('Last-Event-ID')
  const query = typeof req.query.since === 'string' ? req.query.since : undefined
  const since = Number(header ?? query ?? 0) || 0

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  res.write('\n')

  const send = (event: AgentEvent) => res.write(`id: ${event.seq}\ndata: ${JSON.stringify(event)}\n\n`)
  for (const event of rt.log.since(since)) send(event)
  res.write(`data: ${JSON.stringify({ type: 'sync', at: new Date().toISOString(), ...rt.syncState() })}\n\n`)
  const unsubscribe = rt.bus.subscribe(send)

  const keepalive = setInterval(() => res.write(': keepalive\n\n'), KEEPALIVE_MS)
  req.on('close', () => {
    clearInterval(keepalive)
    unsubscribe()
  })
}
