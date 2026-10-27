import type { Runtime } from '../runtime.js'
import { RUN_TABLES } from '../reset.js'

RUN_TABLES.push('history')

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
 */
export class ModelHistory {
  constructor(private readonly rt: Runtime) {}

  append(turn: Turn): void {
    this.rt.db.prepare('INSERT INTO history (role, turn) VALUES (?, ?)').run(turn.role, JSON.stringify(turn))
  }

  all(): Turn[] {
    return (this.rt.db.prepare('SELECT turn FROM history ORDER BY seq').pluck().all() as string[]).map(
      (t) => JSON.parse(t) as Turn,
    )
  }
}
