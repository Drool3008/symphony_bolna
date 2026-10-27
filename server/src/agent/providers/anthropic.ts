import Anthropic from '@anthropic-ai/sdk'
import type { Turn } from '../../store/history.js'
import type { ModelProvider, ModelReply, ToolDeclaration } from './types.js'

export const ANTHROPIC_DEFAULT_MODEL = 'claude-opus-5-5'

export interface AnthropicOptions {
  apiKey: string
  model: string
  /** Which service this is, for errors and for the history's native record. Also OpenCode Go. */
  label: string
  /** An Anthropic-shaped gateway's root, e.g. OpenCode Go. Unset: Anthropic itself. */
  baseURL?: string
  headers?: () => Record<string, string>
  /** Server-side refusal fallback. Anthropic's own API only; a gateway refuses the parameter. */
  fallbacks?: boolean
  /** How hard the model thinks. Anthropic's own API only. */
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max'
  fetch?: typeof fetch
}

/**
 * Claude through the official SDK (reference server/providers/anthropic.js,
 * which used raw REST). One provider serves Anthropic and OpenCode Go, whose
 * /messages endpoint is Anthropic-shaped: only the root, the key and two
 * headers differ.
 *
 * No temperature: the Messages API refuses sampling parameters. The
 * assistant's content blocks are kept and sent back unchanged, thinking
 * blocks included, because an edited thinking block fails the API's check.
 */
export function anthropicProvider(opts: AnthropicOptions): ModelProvider {
  const client = new Anthropic({
    apiKey: opts.apiKey,
    ...(opts.baseURL ? { baseURL: opts.baseURL } : {}),
    ...(opts.fetch ? { fetch: opts.fetch } : {}),
  })
  const native = opts.label

  return {
    label: `${opts.label} / ${opts.model}`,
    async run({ system, history, tools }): Promise<ModelReply> {
      const request = {
        model: opts.model,
        max_tokens: 16000,
        system,
        messages: toMessages(history, native),
        tools: tools.map(toTool),
        ...(opts.effort ? { output_config: { effort: opts.effort } } : {}),
      }
      const headers = opts.headers?.()
      const response = opts.fallbacks
        ? await client.beta.messages.create(
            { ...request, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' },
            headers ? { headers } : undefined,
          )
        : await client.messages.create(request, headers ? { headers } : undefined)

      if (response.stop_reason === 'refusal') {
        throw new Error(`${opts.label} declined this request (refusal${refusalCategory(response)})`)
      }
      const content = response.content as {
        type: string
        text?: string
        id?: string
        name?: string
        input?: unknown
      }[]
      return {
        text: content
          .filter((b) => b.type === 'text')
          .map((b) => b.text ?? '')
          .join(''),
        toolCalls: content
          .filter((b) => b.type === 'tool_use')
          .map((b) => ({
            id: b.id as string,
            name: b.name as string,
            args: (b.input ?? {}) as Record<string, unknown>,
          })),
        native: { provider: native, content },
      }
    },
  }
}

function refusalCategory(response: { stop_details?: unknown }): string {
  const details = response.stop_details as { category?: string | null } | null | undefined
  return details?.category ? `: ${details.category}` : ''
}

const toTool = (t: ToolDeclaration): Anthropic.Tool => ({
  name: t.name,
  description: t.description,
  input_schema: t.parameters as Anthropic.Tool.InputSchema,
})

/** The provider-neutral history as Messages API turns. */
export function toMessages(history: Turn[], native: string): Anthropic.MessageParam[] {
  return history.map((turn): Anthropic.MessageParam => {
    if (turn.role === 'user') {
      return {
        role: 'user',
        content: [
          ...(turn.images ?? []).map((img): Anthropic.ImageBlockParam => ({
            type: 'image',
            source: { type: 'base64', media_type: img.mime as 'image/png', data: img.data },
          })),
          { type: 'text', text: turn.text },
        ],
      }
    }
    if (turn.role === 'model') {
      // This provider's own blocks go back exactly as they came.
      if (turn.native?.provider === native) {
        return { role: 'assistant', content: turn.native.content as Anthropic.ContentBlockParam[] }
      }
      return {
        role: 'assistant',
        content: [
          ...(turn.text ? [{ type: 'text' as const, text: turn.text }] : []),
          ...turn.toolCalls.map((c) => ({
            type: 'tool_use' as const,
            id: c.id,
            name: c.name,
            input: c.args,
          })),
        ],
      }
    }
    return {
      role: 'user',
      content: turn.results.map((r) => ({
        type: 'tool_result' as const,
        tool_use_id: r.id,
        content: typeof r.result === 'string' ? r.result : JSON.stringify(r.result),
        ...(isRefused(r.result) ? { is_error: true } : {}),
      })),
    }
  })
}

const isRefused = (result: unknown) =>
  typeof result === 'object' && result !== null && (result as { ok?: unknown }).ok === false
