import type { Env } from '../../config/env.js'
import { ANTHROPIC_DEFAULT_MODEL, anthropicProvider } from './anthropic.js'
import { GEMINI_DEFAULT_MODEL, geminiProvider } from './gemini.js'
import { OPENCODE_DEFAULT_MODEL, openCodeProvider } from './opencode.js'
import type { ModelProvider } from './types.js'

export interface ProviderDeps {
  /** Stable for one conversation; a reset starts another. */
  conversationKey: () => string
  fetch?: typeof fetch
  /** The scripted provider, for MODEL_PROVIDER=stub. */
  stub?: () => ModelProvider
}

export class ProviderError extends Error {}

/**
 * The model behind the agent, from MODEL_PROVIDER (reference server/agent.js,
 * provider()). The model comes from MODEL_NAME, or ZEN_MODEL for OpenCode Go:
 * MODEL_NAME is usually set for Gemini, and a Gemini model sent to Go is a 400.
 */
export function selectProvider(env: Env, deps: ProviderDeps): ModelProvider {
  const missing = (key: string) =>
    new ProviderError(
      `MODEL_PROVIDER=${env.MODEL_PROVIDER} needs ${key} in .env; nothing was sent to a model`,
    )
  const withFetch = deps.fetch ? { fetch: deps.fetch } : {}

  switch (env.MODEL_PROVIDER) {
    case 'gemini':
      if (!env.GEMINI_API_KEY) throw missing('GEMINI_API_KEY')
      return geminiProvider({
        apiKey: env.GEMINI_API_KEY,
        model: env.MODEL_NAME ?? GEMINI_DEFAULT_MODEL,
        ...withFetch,
      })
    case 'anthropic':
      if (!env.ANTHROPIC_API_KEY) throw missing('ANTHROPIC_API_KEY')
      return anthropicProvider({
        apiKey: env.ANTHROPIC_API_KEY,
        model: env.MODEL_NAME ?? ANTHROPIC_DEFAULT_MODEL,
        label: 'Anthropic',
        fallbacks: true,
        effort: 'high',
        ...withFetch,
      })
    case 'opencode':
      if (!env.OPENCODE_API_KEY) throw missing('OPENCODE_API_KEY')
      return openCodeProvider({
        apiKey: env.OPENCODE_API_KEY,
        model: env.ZEN_MODEL ?? OPENCODE_DEFAULT_MODEL,
        baseURL: env.OPENCODE_BASE_URL,
        conversationKey: deps.conversationKey,
        ...withFetch,
      })
    case 'stub':
      if (!deps.stub) throw new ProviderError('the scripted provider is not available')
      return deps.stub()
  }
}
