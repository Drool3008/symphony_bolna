import { createHash } from 'node:crypto'
import type { ModelProvider } from './types.js'
import { anthropicProvider } from './anthropic.js'

/**
 * OpenCode Go, not OpenCode Zen (reference server/providers/opencode.js).
 * Both are Anthropic-shaped and one path segment apart: /zen/v1 is the
 * pay-per-token gateway and refuses a Go subscription key with 402
 * "Insufficient account funds"; /zen/go/v1 is where a Go key belongs.
 */
export const GO_ROOT = 'https://opencode.ai/zen/go'

/**
 * Go serves forty-odd models and only some speak /messages; glm-5.3-flash is
 * one that refuses. minimax-m3, kimi-k3 and qwen3.8-flash are confirmed to
 * answer and to return tool calls. There are no Claude models on Go.
 */
export const OPENCODE_DEFAULT_MODEL = 'minimax-m3'

/** OPENCODE_BASE_URL as the reference took it (the full /messages URL), or a root. */
export function openCodeRoot(override?: string): string {
  if (!override) return GO_ROOT
  return override.replace(/\/v1\/messages\/?$/, '').replace(/\/$/, '')
}

export interface OpenCodeOptions {
  apiKey: string
  model: string
  baseURL?: string | undefined
  /** Stable for one conversation; a reset starts another. */
  conversationKey: () => string
  fetch?: typeof fetch
}

export function openCodeProvider(opts: OpenCodeOptions): ModelProvider {
  return anthropicProvider({
    apiKey: opts.apiKey,
    model: opts.model,
    label: 'OpenCode Go',
    baseURL: openCodeRoot(opts.baseURL),
    // Go refuses a request without x-opencode-session ("cannot be routed
    // efficiently"), and the id is what lets it cache the prompt, which is
    // resent on every one of up to thirty steps.
    headers: () => ({
      'x-opencode-session': createHash('sha256').update(opts.conversationKey()).digest('hex').slice(0, 32),
      'user-agent': 'family-health-agent/1.0',
    }),
    ...(opts.fetch ? { fetch: opts.fetch } : {}),
  })
}
