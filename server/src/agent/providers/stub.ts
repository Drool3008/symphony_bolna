import { readFileSync } from 'node:fs'
import { fromRoot } from '../../config/paths.js'
import type { SessionValues } from '../../store/session.js'
import type { ModelProvider, ModelReply } from './types.js'

/** What the console shows. It is a script, and it says so. */
export const STUB_LABEL = 'stub (scripted, not a real model)'

interface ScriptTurn extends ModelReply {
  _comment?: string
}

interface Bank {
  bands: Record<string, ScriptTurn[]>
  samples: Record<string, ScriptTurn[]>
}

interface Sample {
  id: string
  expect?: { tier?: string }
}

interface Position {
  /** `default` for config/stub-script.json, or the scenario key. */
  script: string
  turn: number
}

const read = <T>(path: string): T => JSON.parse(readFileSync(fromRoot(path), 'utf8')) as T

/**
 * Replays scripted turns instead of calling a model (reference
 * server/providers/stub.js), so a dry run costs nothing and needs no key. It
 * does not think; it never claims to be a model, and a real run uses a real
 * one.
 *
 * config/stub-script.json is the default take, the refill the clock
 * triggers. config/stub-scenarios.json holds a script per severity band and
 * per sample. A sample trigger picks its script by its id, and the id never
 * travels on the input: a real model reading the expected tier would be
 * handed the answer it is meant to work out (settled decision 1).
 *
 * Where it is in the script is kept in the store, so a restart picks up where
 * the run was rather than replaying from the top.
 */
export class StubProvider implements ModelProvider {
  readonly label = STUB_LABEL

  constructor(private readonly session: SessionValues) {}

  private position(): Position {
    return this.session.get<Position>('stub_position') ?? { script: 'default', turn: 0 }
  }

  private turns(script: string): ScriptTurn[] {
    if (script === 'default') return read<ScriptTurn[]>('config/stub-script.json')
    const bank = read<Bank>('config/stub-scenarios.json')
    const [kind, key] = script.split(':') as [string, string]
    return (kind === 'band' ? bank.bands[key] : bank.samples[key]) ?? []
  }

  /**
   * Points the script at the path a sample trigger is meant to exercise.
   * A sample's own script wins; otherwise its band's. A key that is not a
   * sample may still name a script outright (the spoken account arrives that
   * way). Returns what was picked, or null, leaving the script alone.
   */
  select(sampleId: string | undefined): string | null {
    if (!sampleId) return null
    const bank = read<Bank>('config/stub-scenarios.json')
    const samples = read<{ samples: Sample[] }>('config/trigger-samples.json').samples
    const sample = samples.find((s) => s.id === sampleId)

    let script: string | null = null
    if (bank.samples[sampleId]?.length) script = `sample:${sampleId}`
    else if (sample?.expect?.tier && bank.bands[sample.expect.tier]?.length)
      script = `band:${sample.expect.tier}`
    if (!script) return null
    this.session.set('stub_position', { script, turn: 0 })
    return script
  }

  /** Back to the top of the default take. A reset calls this. */
  rewind(): void {
    this.session.set('stub_position', { script: 'default', turn: 0 })
  }

  async run(): Promise<ModelReply> {
    const at = this.position()
    const turn = this.turns(at.script)[at.turn]
    this.session.set('stub_position', { ...at, turn: at.turn + 1 })
    if (!turn) return { text: `stub script exhausted (${at.script})`, toolCalls: [] }
    return { text: turn.text, toolCalls: turn.toolCalls }
  }
}
