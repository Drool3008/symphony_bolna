import type { Runtime } from '../runtime.js'
import { RUN_TABLES } from '../reset.js'

RUN_TABLES.push('history', 'inbox')

/** A file a member chose to send the agent, as the model reads it. */
export interface ImagePart {
  mime: string
  /** Base64. */
  data: string
  name: string
}

export interface ToolCall {
  id: string
  name: string
  args: Record<string, unknown>
  /** Gemini 3 returns one on each call and wants it sent back unchanged on the next step. */
  thoughtSignature?: string
}

export interface ToolResult {
  id: string
  name: string
  result: unknown
}

/** One turn of the conversation with the model, provider-neutral (reference server/agent.js, session.history). */
export type Turn =
  | { role: 'user'; text: string; images?: ImagePart[] }
  | { role: 'model'; text: string; toolCalls: ToolCall[] }
  | { role: 'tool'; results: ToolResult[] }

/**
 * Everything the model has been given and has said. This is the only thing
 * the model reads besides the system prompt and onboarding. Family chats are
 * not in it, and nothing writes to it except a real input, the model's own
 * turns, and the results of its tool calls (R2).
 *
 * A model's tool calls must be followed straight away by their results, or
 * the providers refuse the history. So while a step is in flight, an input
 * that arrives waits in the inbox, and goes in after the step's results.
 */
export class ModelHistory {
  private holding = false

  constructor(private readonly rt: Runtime) {}

  append(turn: Turn): void {
    this.rt.db.prepare('INSERT INTO history (role, turn) VALUES (?, ?)').run(turn.role, JSON.stringify(turn))
  }

  /** A real input. Into the history now, or into the inbox if a step is in flight. */
  addInput(turn: Extract<Turn, { role: 'user' }>): void {
    if (this.holding) this.rt.db.prepare('INSERT INTO inbox (turn) VALUES (?)').run(JSON.stringify(turn))
    else this.append(turn)
  }

  /** A step starts: inputs wait until its results are written. */
  hold(): void {
    this.holding = true
  }

  /** The step is done: anything that waited goes in, in the order it came. */
  release(): void {
    this.holding = false
    const waiting = this.rt.db.prepare('SELECT seq, turn FROM inbox ORDER BY seq').all() as {
      seq: number
      turn: string
    }[]
    this.rt.db.transaction(() => {
      for (const row of waiting) {
        this.append(JSON.parse(row.turn) as Turn)
        this.rt.db.prepare('DELETE FROM inbox WHERE seq = ?').run(row.seq)
      }
    })()
  }

  /** Inputs not yet in the history. */
  waiting(): number {
    return this.rt.db.prepare('SELECT count(*) FROM inbox').pluck().get() as number
  }

  /**
   * After a restart, a step that was cut off may have left calls with no
   * results. Each gets one saying so, so the history is one a provider will
   * take and the model knows the call never came back.
   */
  closeInterruptedStep(): number {
    const turns = this.all()
    const last = turns.at(-1)
    if (last?.role !== 'model' || last.toolCalls.length === 0) return 0
    this.append({
      role: 'tool',
      results: last.toolCalls.map((c) => ({
        id: c.id,
        name: c.name,
        result: { ok: false, error: 'interrupted: the server restarted before this call came back' },
      })),
    })
    return last.toolCalls.length
  }

  all(): Turn[] {
    return (this.rt.db.prepare('SELECT turn FROM history ORDER BY seq').pluck().all() as string[]).map(
      (t) => JSON.parse(t) as Turn,
    )
  }
}
