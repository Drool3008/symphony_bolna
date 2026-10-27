import type { Turn } from '../../store/history.js'
import type { ModelProvider, ModelReply, ToolDeclaration } from './types.js'

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

/** Not 2.5-pro: a key issued now is refused with "no longer available to new users" (reference). */
export const GEMINI_DEFAULT_MODEL = 'gemini-3.1-pro-preview'

export interface GeminiOptions {
  apiKey: string
  model: string
  fetch?: typeof fetch
  /** Pause between retries; zero in tests. */
  retryMs?: number
}

interface Part {
  text?: string
  inlineData?: { mimeType: string; data: string }
  functionCall?: { name: string; args?: Record<string, unknown> }
  functionResponse?: { name: string; response: unknown }
  thoughtSignature?: string
}

/**
 * Gemini over REST generateContent (reference server/providers/gemini.js).
 * There is no official Gemini SDK in this project; one fetch is the whole
 * surface.
 *
 * generateContent returns no call ids, so the loop mints them. Gemini 3 puts a
 * thought signature on each functionCall part and wants it back unchanged on
 * the next step, or the next step is a 400 ("Function call is missing a
 * thought_signature"); the turn's parts are kept and replayed as they came.
 */
export function geminiProvider(opts: GeminiOptions): ModelProvider {
  const doFetch = opts.fetch ?? fetch
  const retryMs = opts.retryMs ?? 1200

  return {
    label: `Gemini / ${opts.model}`,
    async run({ system, history, tools }): Promise<ModelReply> {
      const body = {
        system_instruction: { parts: [{ text: system }] },
        contents: toContents(history),
        tools: [{ functionDeclarations: tools.map(toDeclaration) }],
      }

      // A 503 "high demand" or a 429 is routine and lasts seconds; retried so
      // one busy minute does not stop a run. A 400 or 404 is ours, and is not.
      let res: Response | undefined
      let json: unknown
      for (let attempt = 0; attempt < 4; attempt++) {
        if (attempt && retryMs) await new Promise((r) => setTimeout(r, retryMs * attempt))
        res = await doFetch(`${BASE}/${opts.model}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': opts.apiKey },
          body: JSON.stringify(body),
        })
        json = await res.json()
        if (res.ok || (res.status !== 429 && res.status < 500)) break
      }
      if (!res?.ok) throw new Error(`Gemini ${res?.status}: ${JSON.stringify(json).slice(0, 600)}`)

      const parts: Part[] =
        (json as { candidates?: { content?: { parts?: Part[] } }[] }).candidates?.[0]?.content?.parts ?? []
      return {
        text: parts
          .filter((p) => p.text)
          .map((p) => p.text)
          .join(''),
        toolCalls: parts
          .filter((p) => p.functionCall)
          .map((p) => ({
            name: p.functionCall?.name ?? '',
            args: p.functionCall?.args ?? {},
            ...(p.thoughtSignature ? { thoughtSignature: p.thoughtSignature } : {}),
          })),
        native: { provider: 'Gemini', content: parts },
      }
    },
  }
}

export function toContents(history: Turn[]) {
  return history.map((turn) => {
    if (turn.role === 'user') {
      return {
        role: 'user',
        parts: [
          { text: turn.text },
          ...(turn.images ?? []).map((img) => ({ inlineData: { mimeType: img.mime, data: img.data } })),
        ],
      }
    }
    if (turn.role === 'model') {
      if (turn.native?.provider === 'Gemini') return { role: 'model', parts: turn.native.content as Part[] }
      return {
        role: 'model',
        parts: [
          ...(turn.text ? [{ text: turn.text }] : []),
          ...turn.toolCalls.map((c) => ({
            functionCall: { name: c.name, args: c.args },
            ...(c.thoughtSignature ? { thoughtSignature: c.thoughtSignature } : {}),
          })),
        ],
      }
    }
    return {
      role: 'user',
      parts: turn.results.map((r) => ({
        functionResponse: {
          name: r.name,
          response: typeof r.result === 'object' && r.result !== null ? r.result : { result: r.result },
        },
      })),
    }
  })
}

const toDeclaration = (t: ToolDeclaration) => ({
  name: t.name,
  description: t.description,
  parameters: toGeminiSchema(t.parameters),
})

/**
 * JSON Schema down to the OpenAPI subset Gemini accepts for function
 * declarations: type, description, enum, properties, required, items, and
 * nothing else. An optional field that JSON Schema writes as a union with
 * null becomes its non-null half.
 */
export function toGeminiSchema(schema: unknown): Record<string, unknown> {
  if (!schema || typeof schema !== 'object') return {}
  const s = schema as Record<string, unknown>
  const union = (s.anyOf ?? s.oneOf) as unknown[] | undefined
  if (union) {
    const real = union.find((u) => (u as { type?: unknown }).type !== 'null')
    return { ...toGeminiSchema(real), ...(s.description ? { description: s.description } : {}) }
  }
  const out: Record<string, unknown> = {}
  if (typeof s.type === 'string') out.type = s.type.toUpperCase()
  if (typeof s.description === 'string') out.description = s.description
  if (Array.isArray(s.enum)) out.enum = s.enum
  if (s.properties && typeof s.properties === 'object') {
    out.properties = Object.fromEntries(
      Object.entries(s.properties as Record<string, unknown>).map(([k, v]) => [k, toGeminiSchema(v)]),
    )
  }
  if (Array.isArray(s.required) && s.required.length) out.required = s.required
  if (s.items) out.items = toGeminiSchema(s.items)
  return out
}
