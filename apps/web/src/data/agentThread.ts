import type { ThreadMessage } from '@family-health/shared'
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { OpenWait, StreamEvent } from '../api/events.js'

/**
 * This member's conversation with the agent: the one place screens get it.
 *
 * Today there is no read route for it (docs/backend-asks.md, ask 1), so it
 * is rebuilt from the stream: a connection replays every event of the current
 * run, then sends new ones (server/src/events.ts). When the read route lands
 * on main, `useAgentThread` fetches from it instead, and no screen changes.
 *
 * The stream still carries every member's events (ask 2), so only this
 * member's share is kept: their own thread, and waits on them. The server
 * is making /events per member; this filter goes when that lands.
 */
export interface AgentThread {
  messages: ThreadMessage[]
  /** Waits the agent has open on this member (server/src/domain/waits.ts). */
  waits: OpenWait[]
}

export const threadKey = (memberId: string) => ['thread', memberId] as const

const EMPTY: AgentThread = { messages: [], waits: [] }

/** Folds one stream event into the member's thread in the cache. */
export function applyThreadEvent(queryClient: QueryClient, event: StreamEvent, memberId: string): void {
  const key = threadKey(memberId)
  const update = (change: (thread: AgentThread) => AgentThread) =>
    queryClient.setQueryData<AgentThread>(key, (thread) => change(thread ?? EMPTY))
  const patch = (id: string, fields: Partial<ThreadMessage>) =>
    update((t) => ({ ...t, messages: t.messages.map((m) => (m.id === id ? { ...m, ...fields } : m)) }))

  switch (event.type) {
    case 'message':
      if (event.message.thread !== memberId) return
      update((t) => ({
        ...t,
        messages: t.messages.some((m) => m.id === event.message.id)
          ? t.messages.map((m) => (m.id === event.message.id ? event.message : m))
          : [...t.messages, event.message],
      }))
      return
    // The answer's sim time is the envelope's clock (server/src/store/event-log.ts).
    case 'card_answered':
      patch(event.message_id, { answer: event.answer, answered_at: event.clock })
      return
    case 'card_timed_out':
      patch(event.message_id, { timed_out_at: event.clock })
      return
    case 'awaiting_reply':
      if (event.from !== memberId) return
      update((t) => ({
        ...t,
        waits: [
          ...t.waits.filter((w) => w.id !== event.id),
          {
            id: event.id,
            member: event.from,
            what_for: event.what_for,
            deadline: event.deadline,
          },
        ],
      }))
      return
    case 'reply_settled':
      if (event.from !== memberId) return
      update((t) => ({ ...t, waits: t.waits.filter((w) => w.id !== event.id) }))
      return
    case 'sync':
      update((t) => ({ ...t, waits: (event.waits ?? []).filter((w) => w.member === memberId) }))
      return
    default:
      return
  }
}

/**
 * Card kinds that report something already done. They are never a question,
 * whatever buttons arrive (the reference's src/components/AgentChat.tsx,
 * RECORDS).
 */
const RECORD_KINDS = new Set(['order_receipt'])

export const isRecordCard = (m: ThreadMessage) => m.card !== null && RECORD_KINDS.has(String(m.card.kind ?? ''))

/** A card the member has not answered and that has not timed out. */
export const isOpenCard = (m: ThreadMessage) =>
  m.card !== null && !isRecordCard(m) && m.answer === null && m.timed_out_at === null

/** Whether anything waits on this member: a card to answer, or a wait the agent has open on them. */
export const waitsOnMember = (thread: AgentThread) =>
  thread.waits.length > 0 || thread.messages.some(isOpenCard)

/**
 * The agent's messages this member has not seen in Chat. Seen is kept by id,
 * not by count, so a new run's messages count from the first one.
 */
export function unreadCount(messages: readonly ThreadMessage[], seen: ReadonlySet<string>): number {
  return messages.filter((m) => m.from === 'agent' && !seen.has(m.id)).length
}

/** `seen` with every agent message in `messages` added; the same set when nothing is new. */
export function markSeen(seen: ReadonlySet<string>, messages: readonly ThreadMessage[]): ReadonlySet<string> {
  const fresh = messages.filter((m) => m.from === 'agent' && !seen.has(m.id))
  return fresh.length === 0 ? seen : new Set([...seen, ...fresh.map((m) => m.id)])
}

export interface ThreadView extends AgentThread {
  /**
   * Cards waiting on this member's answer. They stay inline in the thread;
   * the screen counts them in a bar that scrolls to the first (the
   * reference's src/components/AgentChat.tsx).
   */
  openCards: ThreadMessage[]
  /** How many decisions wait on this member: the bar's count. */
  decisionsWaiting: number
}

/** The screen's view of a thread: everything in order, and what waits on the member. */
export function threadView(thread: AgentThread): ThreadView {
  const openCards = thread.messages.filter(isOpenCard)
  return { ...thread, openCards, decisionsWaiting: openCards.length }
}

export function useAgentThread(memberId: string): ThreadView {
  const queryClient = useQueryClient()
  const { data } = useQuery({
    queryKey: threadKey(memberId),
    queryFn: () => queryClient.getQueryData<AgentThread>(threadKey(memberId)) ?? EMPTY,
    staleTime: Infinity,
  })
  return useMemo(() => threadView(data ?? EMPTY), [data])
}
