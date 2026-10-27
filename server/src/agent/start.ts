import type { Env } from '../config/env.js'
import type { Runtime } from '../runtime.js'
import { Agent, type Guard } from './loop.js'
import type { OperatorQueue } from './operator.js'
import { systemPrompt } from './prompt.js'
import { ProviderError, selectProvider } from './providers/select.js'
import { StubProvider } from './providers/stub.js'
import type { ModelProvider } from './providers/types.js'
import { buildTools, declarations } from './tools.js'

export interface StartedAgent {
  agent: Agent
  /** Set under the stub: picks the script a sample trigger exercises. */
  selectScenario?: (sampleId: string | undefined) => string | null
}

/**
 * The agent the server runs, from the environment. A provider with no key
 * still lets the server start; each run then stops at once with an error
 * event saying which key is missing, rather than inventing anything.
 */
export function startAgent(
  rt: Runtime,
  env: Env,
  operator: OperatorQueue,
  options: { fetch?: typeof fetch; guards?: Guard[]; databasePath: string },
): StartedAgent {
  const stub = env.MODEL_PROVIDER === 'stub' ? new StubProvider(rt.session) : null
  if (stub) rt.hooks.reset.on(() => stub.rewind())

  let provider: ModelProvider
  try {
    provider = selectProvider(env, {
      conversationKey: () => `${options.databasePath}:${rt.log.generation()}`,
      ...(options.fetch ? { fetch: options.fetch } : {}),
      ...(stub ? { stub: () => stub } : {}),
    })
  } catch (err) {
    if (!(err instanceof ProviderError)) throw err
    provider = { label: `${env.MODEL_PROVIDER} (not configured)`, run: () => Promise.reject(err) }
  }

  const agent = new Agent(rt, {
    provider,
    operator,
    tools: () => buildTools(rt),
    declarations,
    systemPrompt: () => systemPrompt(rt),
    ...(options.guards ? { guards: options.guards } : {}),
    // The stub's pause is for people watching a dry run; a real model takes its own time.
    thinkMs: stub ? env.STUB_THINK_MS : 0,
  })
  return { agent, ...(stub ? { selectScenario: (id: string | undefined) => stub.select(id) } : {}) }
}
