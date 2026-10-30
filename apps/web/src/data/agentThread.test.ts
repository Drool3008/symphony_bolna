import type { ThreadMessage } from '@family-health/shared'
import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import type { StreamEvent } from '../api/events.js'
import {
  applyThreadEvent,
  isOpenCard,
  markSeen,
  threadKey,
  threadView,
  unreadCount,
  waitsOnMember,
  type AgentThread,
} from './agentThread.js'

const message = (fields: Partial<ThreadMessage>): ThreadMessage => ({
  id: 'm1',
  thread: 'rp',
  from: 'agent',
  to: 'rp',
  text: 'OK to pay?',
  language: 'en-IN',
  kind: null,
  card: null,
  answer: null,
  answered_at: null,
  timed_out_at: null,
  at: '2026-10-08T18:30:00.000Z',
  ...fields,
})
const env = (seq: number) => ({ seq, at: 'wall', clock: '2026-10-08T18:31:00.000Z' })

function feed(...events: StreamEvent[]) {
  const qc = new QueryClient()
  for (const e of events) applyThreadEvent(qc, e, 'rp')
  return qc.getQueryData<AgentThread>(threadKey('rp'))
}

describe("the member's thread, rebuilt from the stream", () => {
  it("keeps only this member's own thread, never another member's", () => {
    const thread = feed(
      { ...env(1), type: 'message', message: message({ id: 'a', thread: 'patient', to: 'patient' }) },
      { ...env(2), type: 'message', message: message({ id: 'b' }) },
      {
        ...env(3),
        type: 'message',
        message: message({ id: 'c', thread: 'family_group', to: 'family_group' }),
      },
    )
    expect(thread?.messages.map((m) => m.id)).toEqual(['b'])
  })

  it('locks a card with its answer at the sim time, and marks one that timed out', () => {
    const card = { kind: 'spend_above_threshold' }
    const thread = feed(
      { ...env(1), type: 'message', message: message({ id: 'card', card }) },
      { ...env(2), type: 'message', message: message({ id: 'late', card }) },
      { ...env(3), type: 'card_answered', message_id: 'card', answer: 'Approve' },
      { ...env(4), type: 'card_timed_out', message_id: 'late', reason: 'no_answer' },
    )
    expect(thread?.messages[0]).toMatchObject({ answer: 'Approve', answered_at: '2026-10-08T18:31:00.000Z' })
    expect(thread?.messages[1]?.timed_out_at).toBe('2026-10-08T18:31:00.000Z')
    expect(thread?.messages.filter(isOpenCard)).toEqual([])
  })

  it('keeps the waits on this member, from sync and as they open and settle', () => {
    const open = { id: 'w1', from: 'rp', what_for: 'approve', wait_seconds: 180, deadline: 'd' }
    expect(feed({ ...env(1), type: 'awaiting_reply', ...open })?.waits.map((w) => w.id)).toEqual(['w1'])
    expect(
      feed(
        { ...env(1), type: 'awaiting_reply', ...open },
        { ...env(2), type: 'awaiting_reply', ...open, id: 'w2', from: 'patient' },
        {
          ...env(3),
          type: 'reply_settled',
          id: 'w1',
          from: 'rp',
          result: { answered: true, from: 'rp', text: null, action: 'Approve', at: 'c' },
        },
      )?.waits,
    ).toEqual([])
    const synced = feed({
      type: 'sync',
      at: 'w',
      clock: 'c',
      stage: 6,
      generation: 1,
      waits: [
        { id: 'w3', member: 'rp', what_for: 'x', deadline: 'd' },
        { id: 'w4', member: 'patient', what_for: 'y', deadline: 'd' },
      ],
    })
    expect(synced?.waits.map((w) => w.id)).toEqual(['w3'])
  })
})

describe('what the Chat tab shows on its badge', () => {
  const thread = [
    message({ id: 'a1' }),
    message({ id: 'r1', from: 'rp', to: 'agent' }),
    message({ id: 'a2' }),
  ]

  it('counts the agent’s messages not yet seen, and never the member’s own', () => {
    expect(unreadCount(thread, new Set())).toBe(2)
    expect(unreadCount(thread, new Set(['a1']))).toBe(1)
    const seen = markSeen(new Set(), thread)
    expect(unreadCount(thread, seen)).toBe(0)
    expect(markSeen(seen, thread)).toBe(seen)
  })

  it('counts a new run’s messages from the first, though more were seen in the last', () => {
    const seen = markSeen(new Set(), [...thread, message({ id: 'a3' }), message({ id: 'a4' })])
    expect(unreadCount([message({ id: 'n1' })], seen)).toBe(1)
  })

  it('nudges when a card or a wait is open on the member, and not for a receipt', () => {
    const open = message({ id: 'c', card: { kind: 'spend_above_threshold' } })
    const receipt = message({ id: 'r', card: { kind: 'order_receipt' } })
    expect(isOpenCard(receipt)).toBe(false)
    expect(waitsOnMember({ messages: [receipt], waits: [] })).toBe(false)
    expect(waitsOnMember({ messages: [open], waits: [] })).toBe(true)
    expect(waitsOnMember({ messages: [], waits: [{ id: 'w', member: 'rp', what_for: 'x', deadline: 'd' }] })).toBe(
      true,
    )
  })
})

describe('the decisions waiting on the member', () => {
  it('counts open cards, keeps them inline in order, and leaves out answered cards and receipts', () => {
    const view = threadView({
      messages: [
        message({ id: 'a', card: { kind: 'spend_above_threshold' } }),
        message({ id: 'b' }),
        message({ id: 'c', card: { kind: 'test_due' }, answer: 'Not now' }),
        message({ id: 'd', card: { kind: 'order_receipt' } }),
        message({ id: 'e', card: { kind: 'care_quote' } }),
        message({ id: 'f', card: { kind: 'low_wallet' }, timed_out_at: 'x' }),
      ],
      waits: [],
    })
    expect(view.decisionsWaiting).toBe(2)
    expect(view.openCards.map((m) => m.id)).toEqual(['a', 'e'])
    expect(view.messages.map((m) => m.id)).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
  })
})
