import { randomUUID } from 'node:crypto'
import type { Runtime } from '../runtime.js'
import type { ToolCall, ToolResult } from '../store/history.js'
import type { OperatorQueue } from './operator.js'
import type { ModelProvider, ToolDeclaration } from './providers/types.js'
import type { ToolSpec } from './tool.js'

export const MAX_STEPS = 30

/** What a guard returns to refuse a call: the error the model reads, and the rule it enforces. */
export interface Refusal {
  ok: false
  error: string
  rule: string
}

/**
 * A check made on every call in a step before it runs. A refusal goes back
 * to the model in place of running the call, and the model corrects itself.
 * The backend never tells it how. `ran` is this step's calls so far that ran,
 * with what they returned.
 */
export type Guard = (
  call: ToolCall,
  step: { ran: { call: ToolCall; result: unknown }[] },
) => Refusal | undefined

export interface AgentOptions {
  provider: ModelProvider
  /** The catalogue, built fresh each step: it reads onboarding, which a run can change. */
  tools: () => ToolSpec[]
  operator: OperatorQueue
  /** The system prompt with onboarding, built fresh each step. */
  systemPrompt: () => string
  declarations: (tools: ToolSpec[]) => ToolDeclaration[]
  guards?: Guard[]
  /** A pause before each step, so a scripted run can be watched. Zero for anything but the stub. */
  thinkMs?: number
  maxSteps?: number
}

/**
 * The loop: history in, the model's tool calls out, each routed by its mode,
 * the results back in, until the model stops calling tools or it tops out at
 * thirty steps (reference server/agent.js).
 *
 * One run at a time. An input that arrives during a run is picked up by that
 * run, or by another started straight after it. A reset aborts a run at its
 * next step, so it never writes into the session that replaced it.
 */
export class Agent {
  private byName = new Map<string, ToolSpec>()
  private running: Promise<void> | null = null
  private epoch = 0

  constructor(
    private readonly rt: Runtime,
    private readonly opts: AgentOptions,
  ) {
    rt.hooks.input.on(() => this.wake())
    rt.hooks.reset.on(() => this.abort())
    rt.hooks.sync.provide('running', () => this.isRunning())
    rt.hooks.sync.provide('model', () => opts.provider.label)
  }

  isRunning(): boolean {
    return this.running !== null
  }

  /**
   * Something arrived. Runs the loop if none is running; a run in progress
   * picks the input up itself, and goes round again at the end if an input
   * came in that the model has not yet seen.
   */
  wake(): void {
    // Nothing to answer means no call to the model: an empty history is not a
    // question, and a provider refuses one.
    if (this.running || !this.unseenInput()) return
    this.start()
  }

  /**
   * At boot, after a step cut off by a restart has been given its
   * "interrupted" results: the model has to read them, or a run that was
   * waiting on somebody would stop with nobody told (R22). Only for that
   * case; a run that stopped at its step limit stays stopped.
   */
  resume(): void {
    if (this.running || this.rt.history.all().at(-1)?.role !== 'tool') return
    this.start()
  }

  private start(): void {
    this.running = (async () => {
      try {
        do await this.run(this.epoch)
        while (this.unseenInput())
      } catch (err) {
        this.rt.emit('error', { error: (err as Error).message })
      } finally {
        this.running = null
      }
    })()
  }

  /** Resolves once no run is in progress. */
  async settled(): Promise<void> {
    while (this.running) await this.running
  }

  abort(): void {
    this.epoch++
  }

  /** An input the model has not been shown: one still waiting, or one after its last turn. */
  private unseenInput(): boolean {
    return this.rt.history.waiting() > 0 || this.rt.history.all().at(-1)?.role === 'user'
  }

  private async run(epoch: number): Promise<void> {
    const max = this.opts.maxSteps ?? MAX_STEPS
    for (let step = 0; step < max; step++) {
      if (epoch !== this.epoch) return
      this.rt.history.release()
      this.rt.emit('thinking', { step })
      if (this.opts.thinkMs) await pause(this.opts.thinkMs)
      if (epoch !== this.epoch) return

      const tools = this.opts.tools()
      this.byName = new Map(tools.map((t) => [t.name, t]))
      this.rt.history.hold()
      let reply
      try {
        reply = await this.opts.provider.run({
          system: this.opts.systemPrompt(),
          history: this.rt.history.all(),
          tools: this.opts.declarations(tools),
        })
      } catch (err) {
        this.rt.history.release()
        this.rt.emit('error', { error: (err as Error).message })
        return
      }
      if (epoch !== this.epoch) return this.rt.history.release()

      const calls: ToolCall[] = reply.toolCalls.map((c) => ({ ...c, id: c.id ?? randomUUID() }))
      this.rt.emit('model_step', {
        step,
        text: reply.text,
        tool_calls: calls.map(({ id, name, args }) => ({ id, name, args })),
      })
      this.rt.history.append({
        role: 'model',
        text: reply.text,
        toolCalls: calls,
        ...(reply.native ? { native: reply.native } : {}),
      })

      if (calls.length === 0) {
        this.rt.history.release()
        this.rt.emit('idle', { reason: 'the model made no tool calls' })
        return
      }

      const results: ToolResult[] = []
      const ran: { call: ToolCall; result: unknown }[] = []
      for (const call of calls) {
        const refusal = this.refusal(call, ran)
        if (refusal) {
          this.rt.emit('tool_rejected', {
            id: call.id,
            name: call.name,
            reason: refusal.rule,
            result: refusal,
          })
          results.push({ id: call.id, name: call.name, result: refusal })
          continue
        }
        const tool = this.byName.get(call.name)
        this.rt.emit('tool_call', { id: call.id, name: call.name, args: call.args, mode: tool?.mode ?? null })
        const result = await this.execute(call)
        if (epoch !== this.epoch) return this.rt.history.release()
        ran.push({ call, result })
        this.rt.emit('tool_result', { id: call.id, name: call.name, result })
        results.push({ id: call.id, name: call.name, result })
      }
      this.rt.history.append({ role: 'tool', results })
      this.rt.history.release()
    }
    this.rt.emit('error', { error: `stopped after ${max} steps without settling` })
  }

  private refusal(call: ToolCall, ran: { call: ToolCall; result: unknown }[]): Refusal | undefined {
    for (const guard of this.opts.guards ?? []) {
      const refused = guard(call, { ran })
      if (refused) return refused
    }
    return undefined
  }

  /** Runs a call by its mode. An error is an answer the model reads, never a crash. */
  private async execute(call: ToolCall): Promise<unknown> {
    const tool = this.byName.get(call.name)
    if (!tool) return { ok: false, error: `there is no tool called ${call.name}` }

    const parsed = tool.schema.safeParse(call.args ?? {})
    if (!parsed.success) {
      const why = parsed.error.issues
        .map((i) => `${i.path.join('.') || 'arguments'}: ${i.message}`)
        .join('; ')
      return { ok: false, error: `the arguments do not fit ${call.name}: ${why}` }
    }

    if (tool.mode === 'LIVE') {
      if (!tool.handler) return { ok: false, error: `${call.name} has no handler` }
      try {
        return await tool.handler(parsed.data, { rt: this.rt, callId: call.id })
      } catch (err) {
        return { ok: false, error: (err as Error).message }
      }
    }
    const refused = tool.check?.(parsed.data, { rt: this.rt, callId: call.id })
    if (refused !== undefined) return refused
    return this.opts.operator.enqueue({
      callId: call.id,
      tool: tool.name,
      mode: tool.mode,
      request: parsed.data as Record<string, unknown>,
      ...(tool.fixtures ? { fixtures: tool.fixtures } : {}),
    })
  }
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms + Math.random() * 700))
