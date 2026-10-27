/**
 * Events on the stream. The reference's set (server/state.js and the domain
 * modules), with the operator queue in place of the curtain and nothing that
 * existed only for a removed rail. More types arrive as their stages land.
 */
export const EVENT_TYPES = ['reset', 'error', 'clock', 'stage', 'input', 'message', 'chat_message'] as const

export type EventType = (typeof EVENT_TYPES)[number]

/** One event as stored and as sent. `at` is the wall time, `clock` the sim time. */
export interface AgentEvent {
  seq: number
  type: string
  at: string
  clock: string
  [field: string]: unknown
}
