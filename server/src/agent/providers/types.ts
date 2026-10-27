import type { ToolCall, Turn } from '../../store/history.js'

/** A tool as a model is told about it: a name, what it does, and a JSON Schema for its arguments. */
export interface ToolDeclaration {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface ModelRequest {
  system: string
  history: Turn[]
  tools: ToolDeclaration[]
}

export interface ModelReply {
  text: string
  /** Gemini gives no call ids; the loop mints any that are missing. */
  toolCalls: (Omit<ToolCall, 'id'> & { id?: string })[]
  /** The provider's own record of this turn, kept and sent back unchanged. */
  native?: { provider: string; content: unknown }
}

/** One shape for every provider: Gemini, Anthropic, OpenCode Go, and the scripted stub. */
export interface ModelProvider {
  /** What the console shows as the model in play. The stub says it is not a model. */
  label: string
  run(request: ModelRequest): Promise<ModelReply>
}
