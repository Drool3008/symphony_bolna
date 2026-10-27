import type { z } from 'zod'
import type { Runtime } from '../runtime.js'

/**
 * How a tool call is answered. Renamed from the reference's run modes
 * (server/tools.js) with the competition-only ones dropped:
 *   LIVE     the server does it
 *   PERSON   a person answers, in character (was CURTAIN · PERSON)
 *   FIXTURE  answered from a documented fixture (was CURTAIN · DOCS)
 */
export const MODES = ['LIVE', 'PERSON', 'FIXTURE'] as const
export type Mode = (typeof MODES)[number]

export interface ToolContext {
  rt: Runtime
  callId: string
}

export interface ToolSpec<S extends z.ZodObject = z.ZodObject> {
  name: string
  description: string
  mode: Mode
  schema: S
  /** LIVE tools only. */
  handler?: (args: z.infer<S>, ctx: ToolContext) => unknown
  /** PERSON and FIXTURE tools: the answers on file, at fixtures/<path>.json. */
  fixtures?: string
}

export const defineTool = <S extends z.ZodObject>(spec: ToolSpec<S>): ToolSpec<S> => spec
