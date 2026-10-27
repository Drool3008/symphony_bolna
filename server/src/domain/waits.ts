import { randomUUID } from 'node:crypto'
import { RUN_TABLES } from '../reset.js'
import type { Runtime } from '../runtime.js'

RUN_TABLES.push('waits')

export type WaitResult =
  | { answered: true; from: string; text: string | null; action: string | null; at: string }
  | {
      answered: false
      from: string
      reason: 'no_answer' | 'wait_time_elapsed' | 'session_reset' | 'server_restarted'
      at: string
    }

export interface OpenWait {
  id: string
  member: string
  what_for: string
  deadline: string
}

/**
 * wait_for_reply parks here (reference server/humans.js). It ends on exactly
 * three real things: the person replies, somebody says nobody answered, or the
 * sim clock passes the deadline. Never a wall-clock timer: a real timer would
 * be the backend deciding "no answer" on its own.
 */
export class Waits {
  private readonly resolvers = new Map<string, (result: WaitResult) => void>()

  constructor(private readonly rt: Runtime) {
    rt.hooks.clock.on((now) => this.expire(now))
    rt.hooks.reset.on(() => this.releaseAll('session_reset'))
    rt.hooks.sync.provide('waits', () => this.open())
  }

  wait(member: string, seconds: number, whatFor: string): Promise<WaitResult> {
    const id = randomUUID()
    const deadline = new Date(this.rt.clock().getTime() + seconds * 1000).toISOString()
    this.rt.db
      .prepare(
        "INSERT INTO waits (id, member, what_for, deadline, state, opened_at) VALUES (?, ?, ?, ?, 'open', ?)",
      )
      .run(id, member, whatFor, deadline, this.rt.clock().toISOString())
    this.rt.emit('awaiting_reply', { id, from: member, what_for: whatFor, wait_seconds: seconds, deadline })
    return new Promise((resolve) => this.resolvers.set(id, resolve))
  }

  open(): OpenWait[] {
    return this.rt.db
      .prepare("SELECT id, member, what_for, deadline FROM waits WHERE state = 'open' ORDER BY seq")
      .all() as OpenWait[]
  }

  /** A person replied. Settles the wait on them, if there is one. */
  reply(from: string, text: string | null, action: string | null): boolean {
    const wait = this.open().find((w) => w.member === from && this.resolvers.has(w.id))
    if (!wait) return false
    this.settle(wait, 'answered', { answered: true, from, text, action, at: this.rt.clock().toISOString() })
    return true
  }

  /** Somebody playing the phone says this person did not pick up. */
  noAnswer(from: string): boolean {
    const wait = this.open().find((w) => w.member === from && this.resolvers.has(w.id))
    if (!wait) return false
    this.settle(wait, 'no_answer', {
      answered: false,
      from,
      reason: 'no_answer',
      at: this.rt.clock().toISOString(),
    })
    return true
  }

  /** The clock moved: anything past its deadline is a no answer. */
  private expire(now: Date): void {
    for (const wait of this.open()) {
      if (now.getTime() >= Date.parse(wait.deadline)) {
        this.settle(wait, 'expired', {
          answered: false,
          from: wait.member,
          reason: 'wait_time_elapsed',
          at: now.toISOString(),
        })
      }
    }
  }

  /** Lets go of every wait: on a reset, or at boot for waits a run left behind when the server stopped. */
  releaseAll(reason: 'session_reset' | 'server_restarted'): void {
    const at = this.rt.clock().toISOString()
    for (const wait of this.open())
      this.settle(wait, 'abandoned', { answered: false, from: wait.member, reason, at })
    // A reset has already emptied the table; whatever is still held in memory
    // is let go here, so no run is left waiting on a person who is gone.
    for (const resolve of this.resolvers.values()) resolve({ answered: false, from: '', reason, at })
    this.resolvers.clear()
  }

  private settle(wait: OpenWait, state: string, result: WaitResult): void {
    this.rt.db
      .prepare('UPDATE waits SET state = ?, result = ?, settled_at = ? WHERE id = ?')
      .run(state, JSON.stringify(result), this.rt.clock().toISOString(), wait.id)

    // Nobody answered, so the agent falls back on its own rule; a card left
    // open on that person's screen has to say so rather than look live.
    if (!result.answered && result.reason !== 'session_reset') {
      for (const id of this.rt.threads.markCardsTimedOut(wait.member)) {
        this.rt.emit('card_timed_out', { message_id: id, reason: result.reason })
      }
    }
    this.rt.emit('reply_settled', { id: wait.id, from: wait.member, result })
    const resolve = this.resolvers.get(wait.id)
    this.resolvers.delete(wait.id)
    resolve?.(result)
  }
}
