import type { QueryClient } from '@tanstack/react-query'
import { applyThreadEvent } from '../data/agentThread.js'
import type { StreamEvent } from './events.js'

/** What the stream says is true now: the sim clock, the stage, and which run this is. */
export interface SessionState {
  clock: string
  stage: number
  generation: number
}

export const sessionKey = ['session'] as const

interface EventSource {
  on(listener: (event: StreamEvent) => void): () => void
}

/**
 * Feeds the stream into the query cache, so every screen moves when the
 * server does (brief, Section 4).
 *
 * A reset means a new run (server/src/reset.ts): every cached query is reset
 * and the ones on screen fetch again, so nothing from the last run stays
 * visible. The same happens when `sync` reports a generation other than the
 * one the cache was filled in, which is how a client that was offline during
 * a reset finds out.
 */
export interface LiveOptions {
  /** The member this phone belongs to, whose thread the stream fills. */
  memberId?: () => string | null
}

export function connectLive(
  stream: EventSource,
  queryClient: QueryClient,
  options: LiveOptions = {},
): () => void {
  const newRun = (state: SessionState) => {
    void queryClient.resetQueries({ predicate: (q) => q.queryKey[0] !== sessionKey[0] })
    queryClient.setQueryData<SessionState>(sessionKey, state)
  }

  return stream.on((event) => {
    const known = queryClient.getQueryData<SessionState>(sessionKey)
    const me = options.memberId?.() ?? null
    if (me) applyThreadEvent(queryClient, event, me)
    switch (event.type) {
      case 'sync': {
        const state = { clock: event.clock, stage: event.stage, generation: event.generation }
        if (known && known.generation !== event.generation) newRun(state)
        else queryClient.setQueryData<SessionState>(sessionKey, state)
        break
      }
      case 'reset':
        // A connection's replay opens with the reset that began the current run.
        // Before the first sync this app has seen, there is no older run in the
        // cache to clear, and clearing would blank what was just fetched.
        if (!known) break
        newRun({ clock: event.clock, stage: 1, generation: known.generation + 1 })
        break
      case 'clock':
        if (known) queryClient.setQueryData<SessionState>(sessionKey, { ...known, clock: event.clock })
        // Days of cover and due dates are computed by the server against the sim clock.
        void queryClient.invalidateQueries({ queryKey: ['home'] })
        break
      case 'message':
        // The agent wrote to someone: that member's home carries the agent's latest word.
        void queryClient.invalidateQueries({ queryKey: ['home', event.message.thread] })
        break
      case 'stage':
        if (known) queryClient.setQueryData<SessionState>(sessionKey, { ...known, stage: event.stage })
        break
      default:
        break
    }
  })
}
