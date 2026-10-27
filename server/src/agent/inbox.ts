import type { Runtime } from '../runtime.js'
import type { ImagePart } from '../store/history.js'

/** A real input from a real source. Every one says where it came from (R2). */
export interface AgentInput {
  kind: string
  source: string
  [field: string]: unknown
}

/**
 * The only way anything reaches the model's history from outside: a member's
 * message to the agent, an @agent line in the group, a forwarded record, or
 * the clock. The backend adds nothing to it except the sim clock (reference
 * server/agent.js, feed()).
 */
export function deliverInput(
  rt: Runtime,
  input: AgentInput,
  images: ImagePart[] = [],
  attachment?: unknown,
): void {
  const stamped = { ...input, at: rt.clock().toISOString() }
  rt.history.addInput({
    role: 'user',
    text: `Simulated clock: ${rt.clock().toISOString()}\n\n${JSON.stringify(stamped, null, 2)}`,
    ...(images.length ? { images } : {}),
  })
  rt.emit('input', { input: stamped, ...(attachment ? { attachment } : {}) })
  rt.hooks.input.fire()
}
