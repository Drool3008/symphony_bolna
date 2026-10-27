import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { loadOnboarding, ONBOARDING_PATH } from '../src/config/onboarding.js'
import { createRuntime } from '../src/runtime.js'

/** A runtime whose onboarding file is a temp copy the test can edit. */
function setUp() {
  const path = join(mkdtempSync(join(tmpdir(), 'reset-')), 'onboarding.json')
  writeFileSync(path, readFileSync(ONBOARDING_PATH))
  const rt = createRuntime({ databasePath: ':memory:', loadOnboarding: () => loadOnboarding(path) })
  return { rt, app: createApp(rt), path }
}

describe('reset', () => {
  it('rereads onboarding from disk, so one run never leaks into the next', async () => {
    const { rt, app } = setUp()
    // A run edits its working copy, moves the clock and the stage.
    const edited = rt.onboarding()
    edited.current_medicines[0]!.pills_left = 20
    rt.setOnboarding(edited)
    await request(app).post('/api/clock').send({ to: '2026-10-12T09:00:00+05:30', source: 'test' })
    rt.session.set('stage', 6)

    const res = await request(app).post('/api/reset').send({ reason: 'next run' })
    expect(res.status).toBe(200)
    expect(rt.onboarding().current_medicines[0]!.pills_left).toBe(6)
    expect(rt.clock().toISOString()).toBe('2026-10-06T03:42:00.000Z')
    expect(rt.session.get('stage')).toBe(1)
  })

  it('takes an edit made to the file on disk', async () => {
    const { rt, app, path } = setUp()
    const ob = JSON.parse(readFileSync(path, 'utf8'))
    ob.wallet.limit_inr = 6000
    writeFileSync(path, JSON.stringify(ob))
    await request(app).post('/api/reset').send({})
    expect(rt.onboarding().wallet.limit_inr).toBe(6000)
  })

  it('leaves a new generation whose only event is the reset, and keeps the old events', async () => {
    const { rt, app } = setUp()
    rt.emit('stage', { stage: 2 })
    await request(app).post('/api/reset').send({ reason: 'next run' })
    expect(rt.log.since().map((e) => e.type)).toEqual(['reset'])
    expect(rt.log.since()[0]).toMatchObject({ reason: 'next run' })
    expect(rt.db.prepare('SELECT count(*) FROM events').pluck().get()).toBe(2)
  })

  it('changes nothing when the file on disk cannot be used, and says why', async () => {
    const { rt, app, path } = setUp()
    rt.session.set('stage', 6)
    writeFileSync(path, '{ "family": ')
    const res = await request(app).post('/api/reset').send({})
    expect(res.status).toBe(422)
    expect(res.body.error).toMatch(/cannot be used/)
    expect(rt.session.get('stage')).toBe(6)
    expect(rt.log.generation()).toBe(1)
  })

  it('lets go of whatever was held in memory', async () => {
    const { rt, app } = setUp()
    let released = false
    rt.onReset(() => (released = true))
    await request(app).post('/api/reset').send({})
    expect(released).toBe(true)
  })
})
