import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { parseEnv } from '../src/config/env.js'
import { anthropicProvider } from '../src/agent/providers/anthropic.js'
import { geminiProvider, toGeminiSchema } from '../src/agent/providers/gemini.js'
import { openCodeProvider, openCodeRoot } from '../src/agent/providers/opencode.js'
import { ProviderError, selectProvider } from '../src/agent/providers/select.js'
import type { Turn } from '../src/store/history.js'

interface Sent {
  url: string
  headers: Record<string, string>
  body: Record<string, unknown>
}

/** A fetch that records each request and answers from a list. */
function fakeFetch(answers: { status?: number; body: unknown }[]) {
  const sent: Sent[] = []
  let i = 0
  const fn = (async (input: string | URL | Request, init?: RequestInit) => {
    const headers: Record<string, string> = {}
    new Headers(init?.headers).forEach((v, k) => (headers[k] = v))
    sent.push({ url: String(input), headers, body: JSON.parse(String(init?.body)) })
    const answer = answers[Math.min(i++, answers.length - 1)]!
    return new Response(JSON.stringify(answer.body), {
      status: answer.status ?? 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as typeof fetch
  return { fn, sent }
}

const history: Turn[] = [
  { role: 'user', text: 'Simulated clock: x', images: [{ mime: 'image/png', data: 'AAAA', name: 'rx.png' }] },
]
const tools = [
  { name: 'note', description: 'Write it down', parameters: z.toJSONSchema(z.object({ text: z.string() })) },
]

const claudeReply = {
  id: 'msg_1',
  type: 'message',
  role: 'assistant',
  model: 'claude-opus-5-5',
  stop_reason: 'tool_use',
  stop_details: null,
  usage: { input_tokens: 1, output_tokens: 1 },
  content: [
    { type: 'thinking', thinking: '', signature: 'sig-1' },
    { type: 'text', text: 'Noting it.' },
    { type: 'tool_use', id: 'toolu_1', name: 'note', input: { text: 'hi' } },
  ],
}

describe('the Anthropic provider', () => {
  it('sends no temperature, asks for the refusal fallback, and reads tool calls', async () => {
    const { fn, sent } = fakeFetch([{ body: claudeReply }])
    const p = anthropicProvider({
      apiKey: 'k',
      model: 'claude-opus-5-5',
      label: 'Anthropic',
      fallbacks: true,
      effort: 'high',
      fetch: fn,
    })
    const reply = await p.run({ system: 'rules', history, tools })

    const [req] = sent
    expect(req!.url).toMatch(/^https:\/\/api\.anthropic\.com\/v1\/messages/)
    expect(req!.headers['anthropic-version']).toBeTruthy()
    expect(req!.headers['anthropic-beta']).toMatch(/server-side-fallback-2026-07-01/)
    expect(req!.body).not.toHaveProperty('temperature')
    expect(req!.body).toMatchObject({
      model: 'claude-opus-5-5',
      system: 'rules',
      fallbacks: 'default',
      output_config: { effort: 'high' },
    })
    const content = (req!.body.messages as { content: { type: string }[] }[])[0]!.content
    expect(content.map((b) => b.type)).toEqual(['image', 'text'])
    expect(reply).toMatchObject({
      text: 'Noting it.',
      toolCalls: [{ id: 'toolu_1', name: 'note', args: { text: 'hi' } }],
    })
  })

  it('sends its own blocks back unchanged, thinking included, and marks a refused result as an error', async () => {
    const { fn, sent } = fakeFetch([
      { body: claudeReply },
      { body: { ...claudeReply, stop_reason: 'end_turn', content: [{ type: 'text', text: 'done' }] } },
    ])
    const p = anthropicProvider({ apiKey: 'k', model: 'claude-opus-5-5', label: 'Anthropic', fetch: fn })
    const first = await p.run({ system: 's', history, tools })
    await p.run({
      system: 's',
      tools,
      history: [
        ...history,
        {
          role: 'model',
          text: first.text,
          toolCalls: [{ id: 'toolu_1', name: 'note', args: { text: 'hi' } }],
          native: first.native!,
        },
        { role: 'tool', results: [{ id: 'toolu_1', name: 'note', result: { ok: false, error: 'R19' } }] },
      ],
    })
    const messages = sent[1]!.body.messages as { role: string; content: Record<string, unknown>[] }[]
    expect(messages[1]!.content).toEqual(claudeReply.content)
    expect(messages[2]!.content[0]).toMatchObject({
      type: 'tool_result',
      tool_use_id: 'toolu_1',
      is_error: true,
    })
  })

  it('stops with an error, not a guess, when the model declines', async () => {
    const { fn } = fakeFetch([
      {
        body: {
          ...claudeReply,
          stop_reason: 'refusal',
          stop_details: { type: 'refusal', category: 'bio' },
          content: [],
        },
      },
    ])
    const p = anthropicProvider({ apiKey: 'k', model: 'claude-opus-5-5', label: 'Anthropic', fetch: fn })
    await expect(p.run({ system: 's', history, tools })).rejects.toThrow(
      /declined this request \(refusal: bio\)/,
    )
  })
})

describe('OpenCode Go', () => {
  it('goes to /zen/go/v1/messages with the session and agent headers, and no Anthropic-only parameters', async () => {
    const { fn, sent } = fakeFetch([{ body: claudeReply }])
    const p = openCodeProvider({
      apiKey: 'k',
      model: 'minimax-m3',
      conversationKey: () => 'gen-1',
      fetch: fn,
    })
    await p.run({ system: 's', history, tools })
    expect(sent[0]!.url).toMatch(/^https:\/\/opencode\.ai\/zen\/go\/v1\/messages/)
    expect(sent[0]!.headers['x-opencode-session']).toMatch(/^[0-9a-f]{32}$/)
    expect(sent[0]!.headers['user-agent']).toBe('family-health-agent/1.0')
    expect(sent[0]!.body).not.toHaveProperty('fallbacks')
    expect(sent[0]!.body).not.toHaveProperty('output_config')
    expect(p.label).toBe('OpenCode Go / minimax-m3')
  })

  it('takes OPENCODE_BASE_URL as the full /messages URL, as the reference did, or as a root', () => {
    expect(openCodeRoot()).toBe('https://opencode.ai/zen/go')
    expect(openCodeRoot('https://gw.example/zen/go/v1/messages')).toBe('https://gw.example/zen/go')
    expect(openCodeRoot('https://gw.example/root/')).toBe('https://gw.example/root')
  })
})

const geminiReply = (parts: object[]) => ({ candidates: [{ content: { role: 'model', parts } }] })

describe('the Gemini provider', () => {
  it('reads function calls and keeps their thought signatures to send back', async () => {
    const parts = [
      { text: 'Noting.' },
      { functionCall: { name: 'note', args: { text: 'hi' } }, thoughtSignature: 'ts-1' },
    ]
    const { fn, sent } = fakeFetch([{ body: geminiReply(parts) }, { body: geminiReply([{ text: 'done' }]) }])
    const p = geminiProvider({ apiKey: 'g', model: 'gemini-3.1-pro-preview', fetch: fn, retryMs: 0 })
    const first = await p.run({ system: 's', history, tools })
    expect(first.toolCalls).toEqual([{ name: 'note', args: { text: 'hi' }, thoughtSignature: 'ts-1' }])
    expect(sent[0]!.url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent',
    )
    expect(sent[0]!.headers['x-goog-api-key']).toBe('g')

    await p.run({
      system: 's',
      tools,
      history: [
        ...history,
        {
          role: 'model',
          text: first.text,
          toolCalls: [{ id: 'c1', name: 'note', args: {} }],
          native: first.native!,
        },
      ],
    })
    const contents = sent[1]!.body.contents as { parts: unknown[] }[]
    expect(contents[1]!.parts).toEqual(parts)
  })

  it('retries a busy minute, but not a mistake of ours', async () => {
    const busy = fakeFetch([
      { status: 503, body: { error: 'high demand' } },
      { body: geminiReply([{ text: 'ok' }]) },
    ])
    await geminiProvider({ apiKey: 'g', model: 'm', fetch: busy.fn, retryMs: 0 }).run({
      system: 's',
      history,
      tools,
    })
    expect(busy.sent).toHaveLength(2)

    const wrong = fakeFetch([{ status: 400, body: { error: 'bad' } }])
    await expect(
      geminiProvider({ apiKey: 'g', model: 'm', fetch: wrong.fn, retryMs: 0 }).run({
        system: 's',
        history,
        tools,
      }),
    ).rejects.toThrow(/Gemini 400/)
    expect(wrong.sent).toHaveLength(1)
  })

  it('declares tools in the schema subset Gemini accepts', () => {
    const schema = z.toJSONSchema(
      z.object({
        to: z.enum(['patient', 'rp']).describe('Who'),
        n: z.number().optional(),
        tags: z.array(z.string()),
      }),
    )
    const out = JSON.stringify(toGeminiSchema(schema))
    expect(out).not.toMatch(/\$schema|additionalProperties|anyOf|format|pattern/)
    expect(toGeminiSchema(schema)).toEqual({
      type: 'OBJECT',
      properties: {
        to: { type: 'STRING', description: 'Who', enum: ['patient', 'rp'] },
        n: { type: 'NUMBER' },
        tags: { type: 'ARRAY', items: { type: 'STRING' } },
      },
      required: ['to', 'tags'],
    })
  })
})

describe('choosing the provider', () => {
  const deps = { conversationKey: () => 'k' }
  it('refuses to start without the key the chosen provider needs', () => {
    expect(() => selectProvider(parseEnv({ MODEL_PROVIDER: 'anthropic' }), deps)).toThrow(ProviderError)
    expect(() => selectProvider(parseEnv({ MODEL_PROVIDER: 'gemini' }), deps)).toThrow(/GEMINI_API_KEY/)
  })

  it('takes the model from MODEL_NAME, or ZEN_MODEL for OpenCode Go, with the reference defaults', () => {
    expect(
      selectProvider(parseEnv({ MODEL_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'k' }), deps).label,
    ).toBe('Anthropic / claude-opus-5-5')
    expect(selectProvider(parseEnv({ MODEL_PROVIDER: 'gemini', GEMINI_API_KEY: 'k' }), deps).label).toBe(
      'Gemini / gemini-3.1-pro-preview',
    )
    expect(
      selectProvider(
        parseEnv({
          MODEL_PROVIDER: 'opencode',
          OPENCODE_API_KEY: 'k',
          MODEL_NAME: 'gemini-x',
          ZEN_MODEL: 'kimi-k3',
        }),
        deps,
      ).label,
    ).toBe('OpenCode Go / kimi-k3')
  })
})
