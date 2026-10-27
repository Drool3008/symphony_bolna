import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import type { Express } from 'express'

export interface StreamedEvent {
  type: string
  seq?: number
  [field: string]: unknown
}

/** Starts the app on a free port. */
export async function listen(app: Express): Promise<{ server: Server; base: string }> {
  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, () => resolve(s))
  })
  return { server, base: `http://127.0.0.1:${(server.address() as AddressInfo).port}` }
}

/** Opens /events and collects what arrives, until stopped. */
export function openStream(base: string, headers: Record<string, string> = {}) {
  const controller = new AbortController()
  const events: StreamedEvent[] = []
  const done = (async () => {
    const res = await fetch(`${base}/events`, { headers, signal: controller.signal })
    if (!res.body) throw new Error('no body on /events')
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    try {
      for (;;) {
        const { value, done } = await reader.read()
        if (done) return
        buffer += decoder.decode(value, { stream: true })
        let cut
        while ((cut = buffer.indexOf('\n\n')) >= 0) {
          const block = buffer.slice(0, cut)
          buffer = buffer.slice(cut + 2)
          const data = block
            .split('\n')
            .filter((l) => l.startsWith('data: '))
            .map((l) => l.slice(6))
            .join('')
          if (data) events.push(JSON.parse(data) as StreamedEvent)
        }
      }
    } catch {
      // aborted
    }
  })()
  return {
    events,
    async until(predicate: (events: StreamedEvent[]) => boolean, ms = 2000) {
      const start = Date.now()
      while (!predicate(events)) {
        if (Date.now() - start > ms) throw new Error(`timed out; got ${events.map((e) => e.type).join(', ')}`)
        await new Promise((r) => setTimeout(r, 10))
      }
    },
    close() {
      controller.abort()
      return done
    },
  }
}
