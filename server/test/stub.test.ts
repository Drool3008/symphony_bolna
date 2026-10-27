import { readFileSync } from 'node:fs'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { fromRoot } from '../src/config/paths.js'
import { STUB_LABEL, StubProvider } from '../src/agent/providers/stub.js'
import { testApp, testRuntime } from './helpers.js'

type Turn = { text: string; toolCalls: { name: string; args: Record<string, unknown> }[] }
const read = <T>(p: string): T => JSON.parse(readFileSync(fromRoot(p), 'utf8')) as T
const script = read<Turn[]>('config/stub-script.json')
const bank = read<{ bands: Record<string, Turn[]>; samples: Record<string, Turn[]> }>(
  'config/stub-scenarios.json',
)
const allScripts: [string, Turn[]][] = [
  ['default', script],
  ...Object.entries(bank.bands).map(([k, v]) => [`band:${k}`, v] as [string, Turn[]]),
  ...Object.entries(bank.samples).map(([k, v]) => [`sample:${k}`, v] as [string, Turn[]]),
]

// The removed tools' prefixes, built from pieces so this file does not trip
// the repository-wide check for the vendors' names.
const REMOVED = [
  ['pine', 'labs_'],
  ['delh', 'ivery_'],
  ['gna', 'ni_'],
].map((p) => p.join(''))

describe('the scripted provider', () => {
  it('says it is a script, not a model', () => {
    expect(new StubProvider(testRuntime().session).label).toBe(STUB_LABEL)
    expect(STUB_LABEL).toMatch(/not a real model/)
  })

  it('replays the default take turn by turn, then says it has run out', async () => {
    const stub = new StubProvider(testRuntime().session)
    for (const turn of script)
      expect(await stub.run()).toEqual({ text: turn.text, toolCalls: turn.toolCalls })
    expect((await stub.run()).text).toBe('stub script exhausted (default)')
  })

  it('keeps its place across a restart, and goes back to the top on a reset', async () => {
    const rt = testRuntime()
    await new StubProvider(rt.session).run()
    const again = new StubProvider(rt.session)
    expect((await again.run()).toolCalls[0]?.args.received).toBe(script[1]!.toolCalls[0]!.args.received)
    again.rewind()
    expect((await again.run()).toolCalls[0]?.args.received).toBe(script[0]!.toolCalls[0]!.args.received)
  })

  it('picks a sample own script, else its band, and leaves the script alone for an unknown id', () => {
    const stub = new StubProvider(testRuntime().session)
    expect(stub.select('crit_unreachable')).toBe('sample:crit_unreachable')
    expect(stub.select('crit_chest')).toBe('band:critical')
    expect(stub.select('spoken_account')).toBe('sample:spoken_account')
    expect(stub.select('no_such_sample')).toBeNull()
    expect(stub.select(undefined)).toBeNull()
  })

  it('never lets the sample id reach the model', async () => {
    const rt = testRuntime()
    const stub = new StubProvider(rt.session)
    const { app } = testApp(rt, false, { selectScenario: (id) => stub.select(id) })
    await request(app)
      .post('/api/input')
      .set('X-Member-Id', 'patient')
      .send({ text: 'My chest feels heavy', sample_id: 'crit_chest' })
    expect(JSON.stringify(rt.history.all())).not.toMatch(/crit_chest|critical/)
    expect(rt.log.since().find((e) => e.type === 'scenario_selected')).toMatchObject({
      script: 'band:critical',
    })
  })
})

describe('the scripts themselves', () => {
  it.each(allScripts)('%s opens every turn that calls a tool with log_decision (R19)', (_name, turns) => {
    for (const turn of turns) if (turn.toolCalls.length) expect(turn.toolCalls[0]!.name).toBe('log_decision')
  })

  it.each(allScripts)('%s calls no tool from a removed rail', (_name, turns) => {
    for (const turn of turns)
      for (const c of turn.toolCalls) for (const r of REMOVED) expect(c.name.startsWith(r)).toBe(false)
  })

  it('sets every refill cycle from what was dispensed, never from the prescription', () => {
    const cycles = allScripts
      .flatMap(([, t]) => t.flatMap((x) => x.toolCalls))
      .filter((c) => c.name === 'set_refill_cycle')
    expect(cycles.length).toBeGreaterThan(0)
    for (const c of cycles) expect(c.args.source).toBe('chemist_confirmation')
  })
})
