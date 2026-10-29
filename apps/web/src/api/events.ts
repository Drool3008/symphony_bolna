/**
 * The events the server sends on GET /events, typed on the client.
 *
 * REPLACE THIS FILE when shared/src/events.ts types the full set: today it
 * types 7 of the event names and none of their payloads (backend ask). Each
 * type here is read off the code that emits it, named in its comment.
 *
 * On the wire (server/src/events.ts) every logged event is one JSON object:
 * `seq`, `type`, `at` (wall time), `clock` (sim time) and its payload's
 * fields at the top level. `sync` is the exception: sent to one client on
 * connect, not logged, with no `seq` and no `id:` line.
 */
import type { AgentDate, AgentEvent, ChatMessage, Decision, ThreadMessage } from '@family-health/shared'

type Logged<T extends string, P> = { seq: number; type: T; at: string; clock: string } & P

/** A wait the agent has open on a person (server/src/domain/waits.ts, OpenWait). */
export interface OpenWait {
  id: string
  member: string
  what_for: string
  deadline: string
}

/** How a wait ended (server/src/domain/waits.ts, WaitResult). */
export type WaitResult =
  | { answered: true; from: string; text: string | null; action: string | null; at: string }
  | {
      answered: false
      from: string
      reason: 'no_answer' | 'wait_time_elapsed' | 'session_reset' | 'server_restarted'
      at: string
    }

/** A call waiting on a person or a fixture (server/src/agent/operator.ts, QueueItem). */
export interface QueueItem {
  id: string
  call_id: string
  tool: string
  mode: 'LIVE' | 'PERSON' | 'FIXTURE'
  request: Record<string, unknown>
  fixtures: Record<string, unknown>
  state: 'pending' | 'resolved' | 'abandoned'
  response: unknown
  variant: string | null
  via: 'operator' | 'auto' | null
  created_at: string
  resolved_at: string | null
}

/** What is true now, sent once per connection (server/src/events.ts, runtime.ts syncState, and the modules that provide parts). */
export interface SyncEvent {
  type: 'sync'
  at: string
  clock: string
  stage: number
  generation: number
  /** server/src/domain/waits.ts */
  waits?: OpenWait[]
  /** server/src/agent/operator.ts */
  operator_pending?: number
  /** server/src/agent/loop.ts */
  running?: boolean
  /** server/src/agent/loop.ts: the provider's label, e.g. "stub (scripted, not a real model)". */
  model?: string
}

export type StreamEvent =
  | SyncEvent
  /** server/src/reset.ts */
  | Logged<'reset', { reason: string }>
  /** server/src/agent/loop.ts */
  | Logged<'error', { error: string }>
  /** server/src/clock.ts. `clock` is the new sim time. */
  | Logged<'clock', { source: string; reached: AgentDate[] }>
  /** server/src/agent/tools.ts, set_stage */
  | Logged<'stage', { stage: number; why: string }>
  /** server/src/agent/inbox.ts. `input` is what the model was given, with its source (R2). */
  | Logged<
      'input',
      { input: { kind: string; source: string; at: string; [field: string]: unknown }; attachment?: unknown }
    >
  /** server/src/store/conversations.ts, AgentThreads.post */
  | Logged<'message', { message: ThreadMessage }>
  /** server/src/store/conversations.ts, FamilyChats.post */
  | Logged<'chat_message', { key: string; message: ChatMessage }>
  /** server/src/store/conversations.ts, answerCard */
  | Logged<'card_answered', { message_id: string; answer: string; at: string }>
  /** server/src/domain/waits.ts */
  | Logged<'card_timed_out', { message_id: string; reason: string }>
  /** server/src/domain/waits.ts */
  | Logged<
      'awaiting_reply',
      { id: string; from: string; what_for: string; wait_seconds: number; deadline: string }
    >
  /** server/src/domain/waits.ts */
  | Logged<'reply_settled', { id: string; from: string; result: WaitResult }>
  /** server/src/app.ts, POST /api/no-answer */
  | Logged<'no_answer', { from: string; source: string }>
  /** server/src/store/decisions.ts */
  | Logged<'decision', { decision: Decision }>
  /** server/src/agent/loop.ts */
  | Logged<'thinking', { step: number }>
  /** server/src/agent/loop.ts */
  | Logged<
      'model_step',
      { step: number; text: string | null; tool_calls: { id: string; name: string; args: unknown }[] }
    >
  /** server/src/agent/loop.ts */
  | Logged<'tool_call', { id: string; name: string; args: unknown; mode: string | null }>
  /** server/src/agent/loop.ts */
  | Logged<'tool_result', { id: string; name: string; result: unknown }>
  /** server/src/agent/loop.ts */
  | Logged<'tool_rejected', { id: string; name: string; reason: string; result: unknown }>
  /** server/src/agent/loop.ts */
  | Logged<'idle', { reason: string }>
  /** server/src/agent/operator.ts */
  | Logged<'operator_pending', { item: QueueItem }>
  /** server/src/agent/operator.ts */
  | Logged<'operator_resolved', { id: string; response: unknown; variant: string | null; via: string }>
  /** server/src/agent/tools.ts, record_update */
  | Logged<'record_update', { target: string; id: string; changes: Record<string, unknown>; why: string }>
  /** server/src/app.ts, POST /api/input under the stub */
  | Logged<'scenario_selected', { sample_id: string; script: string; note: string }>

export type StreamEventType = StreamEvent['type']

const KNOWN = new Set<string>([
  'sync',
  'reset',
  'error',
  'clock',
  'stage',
  'input',
  'message',
  'chat_message',
  'card_answered',
  'card_timed_out',
  'awaiting_reply',
  'reply_settled',
  'no_answer',
  'decision',
  'thinking',
  'model_step',
  'tool_call',
  'tool_result',
  'tool_rejected',
  'idle',
  'operator_pending',
  'operator_resolved',
  'record_update',
  'scenario_selected',
])

/**
 * One event from its JSON text. Unknown types come back as null and are
 * ignored, so a new event on the server never breaks the app.
 */
export function readEvent(data: string): StreamEvent | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(data)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null
  const type = (parsed as { type?: unknown }).type
  if (typeof type !== 'string' || !KNOWN.has(type)) return null
  return parsed as StreamEvent
}

/** The shared envelope, for code that only needs seq, type and the times. */
export type Envelope = AgentEvent
