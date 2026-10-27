import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadOnboarding } from '../src/config/onboarding.js'
import { createRuntime } from '../src/runtime.js'
import { testRuntime } from './helpers.js'

describe('the session store', () => {
  it('starts from onboarding: its clock, stage Idle, generation one', () => {
    const rt = testRuntime()
    expect(rt.clock().toISOString()).toBe('2026-10-06T03:42:00.000Z')
    expect(rt.session.get('stage')).toBe(1)
    expect(rt.log.generation()).toBe(1)
    expect(rt.onboarding().family.members).toHaveLength(3)
  })

  it('appends events in order, each with its sequence, wall time and sim time', () => {
    const rt = testRuntime()
    const a = rt.emit('stage', { stage: 2, why: 'test' })
    const b = rt.emit('message', { text: 'hello' })
    expect(b.seq).toBeGreaterThan(a.seq)
    expect(a).toMatchObject({ type: 'stage', stage: 2, clock: '2026-10-06T03:42:00.000Z' })
    expect(rt.log.since().map((e) => e.type)).toEqual(['stage', 'message'])
    expect(rt.log.since(a.seq).map((e) => e.type)).toEqual(['message'])
  })

  it('refuses to change or delete a logged event', () => {
    const rt = testRuntime()
    rt.emit('stage', { stage: 2 })
    expect(() => rt.db.prepare("UPDATE events SET type = 'x'").run()).toThrow(/append-only/)
    expect(() => rt.db.prepare('DELETE FROM events').run()).toThrow(/append-only/)
  })

  it('replays only the current generation once a new one starts', () => {
    const rt = testRuntime()
    rt.emit('stage', { stage: 2 })
    rt.log.nextGeneration()
    rt.emit('reset', {})
    expect(rt.log.since().map((e) => e.type)).toEqual(['reset'])
    expect(rt.db.prepare('SELECT count(*) FROM events').pluck().get()).toBe(2)
  })

  it('keeps everything across a restart on the same file', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'store-')), 'session.sqlite')
    const first = createRuntime({ databasePath: path, loadOnboarding: () => loadOnboarding() })
    first.session.set('stage', 6)
    first.emit('stage', { stage: 6 })
    first.db.close()

    let reread = false
    const second = createRuntime({
      databasePath: path,
      loadOnboarding: () => {
        reread = true
        return loadOnboarding()
      },
    })
    expect(reread).toBe(false)
    expect(second.session.get('stage')).toBe(6)
    expect(second.log.since().map((e) => e.type)).toEqual(['stage'])
  })
})
