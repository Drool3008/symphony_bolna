import { existsSync, readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { fromRoot } from '../config/paths.js'
import { HttpError } from '../http.js'
import { RUN_TABLES } from '../reset.js'
import type { Runtime } from '../runtime.js'
import type { Mode } from './tool.js'

RUN_TABLES.push('operator_queue')

export type Fixtures = Record<string, Record<string, unknown>>

export interface QueueItem {
  id: string
  call_id: string
  tool: string
  mode: Mode
  request: Record<string, unknown>
  /** The answers on file a person may pick from, keyed by variant. `_` keys are notes, not answers. */
  fixtures: Fixtures
  state: 'pending' | 'resolved' | 'abandoned'
  response: unknown
  variant: string | null
  via: 'operator' | 'auto' | null
  created_at: string
  resolved_at: string | null
}

interface Row extends Omit<QueueItem, 'request' | 'fixtures' | 'response'> {
  request: string
  fixtures: string
  response: string | null
}

const toItem = (r: Row): QueueItem => ({
  ...r,
  request: JSON.parse(r.request) as Record<string, unknown>,
  fixtures: JSON.parse(r.fixtures) as Fixtures,
  response: r.response === null ? null : (JSON.parse(r.response) as unknown),
})

/** fixtures/<path>.json, or nothing. Never a made-up answer. */
export function loadFixtures(path: string | undefined): Fixtures {
  if (!path) return {}
  const file = fromRoot(`fixtures/${path}.json`)
  if (!existsSync(file)) return {}
  return JSON.parse(readFileSync(file, 'utf8')) as Fixtures
}

const answers = (fixtures: Fixtures) => Object.keys(fixtures).filter((k) => !k.startsWith('_'))

/**
 * Tool calls a person or a fixture answers (reference server/curtain.js). The
 * agent's call waits here until somebody answers it. No timeout and no
 * default: a call stalling is better than the agent treating an invented
 * reply as real.
 *
 * OPERATOR_AUTO answers FIXTURE calls from their own fixture file, as the
 * brief has it. A PERSON call (somebody picking up the phone) always waits for
 * a person.
 */
export class OperatorQueue {
  private readonly resolvers = new Map<string, (response: unknown) => void>()

  constructor(
    private readonly rt: Runtime,
    private readonly auto: boolean,
  ) {
    rt.hooks.reset.on(() => this.abandonAll('session reset'))
    rt.hooks.sync.provide('operator_pending', () => this.pending().length)
  }

  /** Parks a call and resolves with the answer. */
  enqueue(call: {
    callId: string
    tool: string
    mode: Mode
    request: Record<string, unknown>
    fixtures?: string
  }) {
    const fixtures = loadFixtures(call.fixtures)
    const item: QueueItem = {
      id: randomUUID(),
      call_id: call.callId,
      tool: call.tool,
      mode: call.mode,
      request: call.request,
      fixtures,
      state: 'pending',
      response: null,
      variant: null,
      via: null,
      created_at: new Date().toISOString(),
      resolved_at: null,
    }
    this.rt.db
      .prepare(
        `INSERT INTO operator_queue (id, call_id, tool, mode, request, fixtures, state, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
      )
      .run(
        item.id,
        item.call_id,
        item.tool,
        item.mode,
        JSON.stringify(item.request),
        JSON.stringify(fixtures),
        item.created_at,
      )
    this.rt.emit('operator_pending', { item })

    const answered = new Promise<unknown>((resolve) => this.resolvers.set(item.id, resolve))
    if (this.auto && call.mode === 'FIXTURE') {
      const variant = ['success', ...answers(fixtures)].find((k) => fixtures[k])
      if (variant) this.settle(item.id, fixtures[variant], variant, 'auto')
      else this.settle(item.id, { ok: false, error: `no fixture on file for ${call.tool}` }, null, 'auto')
    }
    return answered
  }

  /**
   * A person answers. A FIXTURE call takes a variant on file, exactly as
   * written: there is no editor on that path. A PERSON call takes an outcome
   * variant and what the person said, or a typed answer.
   */
  respond(
    id: string,
    answer: { variant?: string | undefined; response?: Record<string, unknown> | undefined },
  ): QueueItem {
    const item = this.get(id)
    if (!item) throw new HttpError(404, `nothing waiting with id ${id}`)
    if (item.state !== 'pending') throw new HttpError(409, `that call is already ${item.state}`)
    if (!this.resolvers.has(id)) throw new HttpError(409, 'nothing is waiting on that call any more')

    const onFile = answer.variant !== undefined ? item.fixtures[answer.variant] : undefined
    if (answer.variant !== undefined && (!onFile || answer.variant.startsWith('_'))) {
      throw new HttpError(
        400,
        `${answer.variant} is not an answer on file. On file: ${answers(item.fixtures).join(', ')}`,
      )
    }
    if (item.mode === 'FIXTURE') {
      if (!onFile) throw new HttpError(400, `pick an answer on file: ${answers(item.fixtures).join(', ')}`)
      if (answer.response)
        throw new HttpError(400, 'a fixture is sent exactly as written; it cannot be edited')
      this.settle(id, onFile, answer.variant ?? null, 'operator')
    } else {
      if (!onFile && !answer.response)
        throw new HttpError(400, 'say what happened: an outcome on file, or a typed answer')
      this.settle(id, { ...(onFile ?? {}), ...(answer.response ?? {}) }, answer.variant ?? null, 'operator')
    }
    return this.get(id) as QueueItem
  }

  pending(): QueueItem[] {
    return (
      this.rt.db.prepare("SELECT * FROM operator_queue WHERE state = 'pending' ORDER BY seq").all() as Row[]
    ).map(toItem)
  }

  get(id: string): QueueItem | null {
    const row = this.rt.db.prepare('SELECT * FROM operator_queue WHERE id = ?').get(id) as Row | undefined
    return row ? toItem(row) : null
  }

  /**
   * Lets go of every waiting call: on a reset, or at boot for calls left by a
   * run that died with the server. Their callers get an error, never an answer.
   */
  abandonAll(reason: string): void {
    for (const resolve of this.resolvers.values()) resolve({ ok: false, error: reason })
    this.resolvers.clear()
    this.rt.db
      .prepare("UPDATE operator_queue SET state = 'abandoned', resolved_at = ? WHERE state = 'pending'")
      .run(new Date().toISOString())
  }

  private settle(id: string, response: unknown, variant: string | null, via: 'operator' | 'auto') {
    const resolve = this.resolvers.get(id)
    this.resolvers.delete(id)
    this.rt.db
      .prepare(
        "UPDATE operator_queue SET state = 'resolved', response = ?, variant = ?, via = ?, resolved_at = ? WHERE id = ?",
      )
      .run(JSON.stringify(response), variant, via, new Date().toISOString(), id)
    this.rt.emit('operator_resolved', { id, response, variant, via })
    resolve?.(response)
  }
}
