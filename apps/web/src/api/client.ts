import type {
  ChatSendRequest,
  ChatSendResponse,
  ForwardRequest,
  MemberHomeResponse,
  MembersResponse,
  ReplyRequest,
} from '@family-health/shared'
import { API_BASE, apiUrl } from './base.js'

/**
 * Response bodies the server sends that shared/ does not type yet. Each is
 * read off server/src/app.ts; replace them when shared/ exports them.
 */
/** POST /api/input. `as` says whether the line ended a wait on this person or started something new. */
export interface InputResponse {
  ok: true
  as: 'reply' | 'input'
}

/** POST /api/reply. `delivered` is false when the agent was not waiting on this person. */
export interface ReplyResponse {
  ok: true
  delivered: boolean
}

/** POST /api/forward. */
export interface ForwardResponse {
  ok: true
}

/** POST /api/input's body (server/src/app.ts, InputBody). `sample_id` only picks the stub's script. */
export interface InputRequest {
  text: string
  sample_id?: string
}

/**
 * A request that did not get a usable answer. `refused` is the server saying
 * no, with its own words in `reason` (server/src/http.ts sends `{ error }`).
 * `offline` is the server not being reached at all.
 */
export class ApiError extends Error {
  constructor(
    readonly kind: 'refused' | 'offline',
    readonly reason: string,
    readonly status: number | null = null,
  ) {
    super(reason)
  }
}

export interface ApiOptions {
  base?: string
  fetch?: typeof fetch
  /** Headers every request carries, read fresh each time. */
  headers?: () => Record<string, string>
}

export type Api = ReturnType<typeof createApi>

/** One client for every request the app makes. */
export function createApi({ base = API_BASE, fetch: send = fetch, headers = () => ({}) }: ApiOptions = {}) {
  async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    let res: Response
    try {
      res = await send(apiUrl(path, base), {
        method,
        headers: {
          Accept: 'application/json',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...headers(),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
    } catch {
      throw new ApiError('offline', 'The app cannot reach the family server right now.')
    }
    const text = await res.text()
    let parsed: unknown = undefined
    try {
      parsed = text ? JSON.parse(text) : undefined
    } catch {
      // Not JSON: a proxy or gateway page. Its status still says what happened.
    }
    if (!res.ok) {
      const said = (parsed as { error?: unknown } | undefined)?.error
      const reason = typeof said === 'string' && said ? said : `The server answered ${res.status}.`
      throw new ApiError('refused', reason, res.status)
    }
    return parsed as T
  }

  return {
    members: () => request<MembersResponse>('GET', '/api/members'),
    home: (memberId: string) =>
      request<MemberHomeResponse>('GET', `/api/members/${encodeURIComponent(memberId)}/home`),
    input: (body: InputRequest) => request<InputResponse>('POST', '/api/input', body),
    reply: (body: ReplyRequest) => request<ReplyResponse>('POST', '/api/reply', body),
    chatSend: (body: ChatSendRequest) => request<ChatSendResponse>('POST', '/api/chat/send', body),
    forward: (body: ForwardRequest) => request<ForwardResponse>('POST', '/api/forward', body),
  }
}
