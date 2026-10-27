import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { agentDates } from '../src/clock.js'
import { testApp, testRuntime } from './helpers.js'

function setUp() {
  const rt = testRuntime()
  return { rt, app: testApp(rt).app }
}

describe('the simulated clock', () => {
  it('lists the agent own dates in order', () => {
    const { rt } = setUp()
    const dates = agentDates(rt.onboarding(), rt.clock())
    expect(dates.slice(0, 3)).toEqual([
      { kind: 'test_due', id: 'test_1', member: 'patient', date: '2026-09-04' },
      { kind: 'medicine_runs_out', id: 'med_chronic_1', member: 'patient', date: '2026-10-09' },
      { kind: 'medicine_runs_out', id: 'med_chronic_2', member: 'rp', date: '2026-10-16' },
    ])
  })

  it('does not move on its own while wall time passes', async () => {
    const { rt } = setUp()
    const before = rt.clock().toISOString()
    await new Promise((r) => setTimeout(r, 30))
    expect(rt.clock().toISOString()).toBe(before)
  })

  it('moves when a person moves it, says who, and reports the dates it reached', async () => {
    const { rt, app } = setUp()
    const res = await request(app)
      .post('/api/clock')
      .send({ to: '2026-10-10T09:00:00+05:30', source: 'Operator, dry run' })
    expect(res.status).toBe(200)
    expect(res.body.clock).toBe('2026-10-10T03:30:00.000Z')
    expect(res.body.reached).toEqual([
      { kind: 'medicine_runs_out', id: 'med_chronic_1', member: 'patient', date: '2026-10-09' },
    ])
    expect(rt.log.since().find((e) => e.type === 'clock')).toMatchObject({ source: 'Operator, dry run' })
    // A date reached is a trigger, with the clock as its source.
    expect(rt.log.since().at(-1)).toMatchObject({ type: 'input', input: { kind: 'clock' } })
  })

  it('moves to the agent next date, at the start of that day on the family clock', async () => {
    const { app } = setUp()
    const res = await request(app)
      .post('/api/clock')
      .send({ to_next_date: true, source: 'Clock, next refill date' })
    expect(res.body.clock).toBe('2026-10-08T18:30:00.000Z')
    expect(res.body.reached.map((d: { id: string }) => d.id)).toEqual(['med_chronic_1'])
  })

  it('counts days of cover down as it moves', async () => {
    const { app } = setUp()
    await request(app).post('/api/clock').send({ to: '2026-10-08T09:00:00+05:30', source: 'test' })
    const home = await request(app).get('/api/members/patient/home').set('X-Member-Id', 'patient')
    expect(home.body.medicines[0]).toMatchObject({
      days_of_cover: 1,
      runs_out_on: '2026-10-09',
      stock_as_of: '2026-10-06',
    })
  })

  it('refuses to go backwards, or to move without a source', async () => {
    const { app } = setUp()
    const back = await request(app)
      .post('/api/clock')
      .send({ to: '2026-10-01T09:00:00+05:30', source: 'test' })
    expect(back.status).toBe(400)
    expect(back.body.error).toMatch(/does not go backwards/)
    const anon = await request(app).post('/api/clock').send({ to: '2026-10-10T09:00:00+05:30' })
    expect(anon.status).toBe(400)
    expect(anon.body.error).toMatch(/source/)
  })

  it('tells whatever is watching it that it moved', async () => {
    const { rt, app } = setUp()
    const seen: string[] = []
    rt.hooks.clock.on((now) => seen.push(now.toISOString()))
    await request(app).post('/api/clock').send({ to: '2026-10-07T09:00:00+05:30', source: 'test' })
    expect(seen).toEqual(['2026-10-07T03:30:00.000Z'])
  })
})
