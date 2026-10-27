import { randomUUID } from 'node:crypto'
import type { ChatMessage, ThreadMessage } from '@family-health/shared'
import type { Runtime } from '../runtime.js'
import { RUN_TABLES } from '../reset.js'

RUN_TABLES.push('messages', 'chat_messages')

interface MessageRow {
  id: string
  thread: string
  sender: string
  recipient: string
  text: string
  language: string | null
  kind: string | null
  card: string | null
  answer: string | null
  answered_at: string | null
  timed_out_at: string | null
  at: string
}

const toMessage = (r: MessageRow): ThreadMessage => ({
  id: r.id,
  thread: r.thread,
  from: r.sender,
  to: r.recipient,
  text: r.text,
  language: r.language,
  kind: r.kind,
  card: r.card === null ? null : (JSON.parse(r.card) as Record<string, unknown>),
  answer: r.answer,
  answered_at: r.answered_at,
  timed_out_at: r.timed_out_at,
  at: r.at,
})

/**
 * The agent's conversations: one thread per family member, the family group,
 * and the doctor (reference server/state.js, `session.messages`). A message
 * from the agent and the person's reply sit in the same thread, the thread of
 * the person who is not the agent.
 */
export class AgentThreads {
  constructor(private readonly rt: Runtime) {}

  post(message: {
    thread: string
    from: string
    to: string
    text: string
    language?: string | null
    kind?: string | null
    card?: Record<string, unknown> | null
  }): ThreadMessage {
    const row: MessageRow = {
      id: randomUUID(),
      thread: message.thread,
      sender: message.from,
      recipient: message.to,
      text: message.text,
      language: message.language ?? null,
      kind: message.kind ?? null,
      card: message.card ? JSON.stringify(message.card) : null,
      answer: null,
      answered_at: null,
      timed_out_at: null,
      at: this.rt.clock().toISOString(),
    }
    this.rt.db
      .prepare(
        `INSERT INTO messages (id, thread, sender, recipient, text, language, kind, card, answer, answered_at, timed_out_at, at)
         VALUES (@id, @thread, @sender, @recipient, @text, @language, @kind, @card, @answer, @answered_at, @timed_out_at, @at)`,
      )
      .run(row)
    const stored = toMessage(row)
    this.rt.emit('message', { message: stored })
    return stored
  }

  thread(thread: string): ThreadMessage[] {
    return (
      this.rt.db.prepare('SELECT * FROM messages WHERE thread = ? ORDER BY seq').all(thread) as MessageRow[]
    ).map(toMessage)
  }

  find(id: string): ThreadMessage | null {
    const row = this.rt.db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as MessageRow | undefined
    return row ? toMessage(row) : null
  }

  /** Marks the person's unanswered cards as timed out. Returns their ids. */
  markCardsTimedOut(thread: string): string[] {
    const at = this.rt.clock().toISOString()
    const ids = this.rt.db
      .prepare(
        'SELECT id FROM messages WHERE thread = ? AND card IS NOT NULL AND answer IS NULL AND timed_out_at IS NULL',
      )
      .pluck()
      .all(thread) as string[]
    for (const id of ids) this.rt.db.prepare('UPDATE messages SET timed_out_at = ? WHERE id = ?').run(at, id)
    return ids
  }

  /** Locks the answer onto a card, so it survives a reload and every screen shows the same thing. */
  answerCard(id: string, answer: string): ThreadMessage | null {
    const at = this.rt.clock().toISOString()
    const changed = this.rt.db
      .prepare(
        'UPDATE messages SET answer = ?, answered_at = ? WHERE id = ? AND card IS NOT NULL AND answer IS NULL',
      )
      .run(answer, at, id).changes
    if (!changed) return null
    this.rt.emit('card_answered', { message_id: id, answer, at })
    return this.find(id)
  }
}

interface ChatRow {
  id: string
  chat_key: string
  sender: string
  text: string
  to_agent: number
  at: string
}

/**
 * What the family says to each other (reference `session.chats`). The agent
 * never reads these (R2): nothing here is handed to the model.
 *
 * A group keeps its own id. A direct chat hangs off the pair, so a line typed
 * on one handset shows on the other (reference server/state.js, chatKey).
 */
export class FamilyChats {
  constructor(
    private readonly rt: Runtime,
    private readonly groupIds: ReadonlySet<string>,
  ) {}

  keyFor(from: string, chatId: string): string {
    if (this.groupIds.has(chatId)) return chatId
    return ['dm', ...[from, chatId].sort()].join(':')
  }

  isGroup(chatId: string): boolean {
    return this.groupIds.has(chatId)
  }

  post(message: { from: string; chatId: string; text: string; toAgent?: boolean }): ChatMessage {
    const row: ChatRow = {
      id: randomUUID(),
      chat_key: this.keyFor(message.from, message.chatId),
      sender: message.from,
      text: message.text,
      to_agent: message.toAgent ? 1 : 0,
      at: this.rt.clock().toISOString(),
    }
    this.rt.db
      .prepare(
        'INSERT INTO chat_messages (id, chat_key, sender, text, to_agent, at) VALUES (@id, @chat_key, @sender, @text, @to_agent, @at)',
      )
      .run(row)
    const stored: ChatMessage = {
      id: row.id,
      key: row.chat_key,
      from: row.sender,
      text: row.text,
      to_agent: row.to_agent === 1,
      at: row.at,
    }
    this.rt.emit('chat_message', { key: stored.key, message: stored })
    return stored
  }

  chat(key: string): ChatMessage[] {
    return (
      this.rt.db.prepare('SELECT * FROM chat_messages WHERE chat_key = ? ORDER BY seq').all(key) as ChatRow[]
    ).map((r) => ({
      id: r.id,
      key: r.chat_key,
      from: r.sender,
      text: r.text,
      to_agent: r.to_agent === 1,
      at: r.at,
    }))
  }
}
