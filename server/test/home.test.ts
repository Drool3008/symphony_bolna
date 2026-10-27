import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { testApp } from './helpers.js'
import { addDays, calendarDate, daysBetween, offsetMinutes } from '../src/domain/dates.js'

const app = testApp().app
const home = async (id: string, viewer = id) =>
  (await request(app).get(`/api/members/${id}/home`).set('X-Member-Id', viewer)).body

describe('calendar dates on the family clock', () => {
  it('reads the date at the clock offset, not the host timezone', () => {
    expect(offsetMinutes('2026-10-06T09:12:00+05:30')).toBe(330)
    // 00:30 IST on the 7th is still the 6th in UTC.
    expect(calendarDate(new Date('2026-10-06T19:00:00Z'), 330)).toBe('2026-10-07')
    expect(addDays('2026-06-06', 90)).toBe('2026-09-04')
    expect(daysBetween('2026-10-06', '2026-09-04')).toBe(-32)
  })
})

describe('GET /api/members/:id/home, at the sim clock start', () => {
  it("gives Lakshmi's Metoprolol 3 days: 6 pills at 2 a day", async () => {
    const lakshmi = await home('patient')
    expect(lakshmi.today).toBe('2026-10-06')
    expect(lakshmi.medicines).toEqual([
      expect.objectContaining({
        id: 'med_chronic_1',
        stock: 6,
        unit: 'pills',
        days_of_cover: 3,
        runs_out_on: '2026-10-09',
        must_not_miss: true,
      }),
    ])
  })

  it("shows Lakshmi's BP check as overdue rather than clamping it", async () => {
    const [bp] = (await home('patient')).tests
    expect(bp).toMatchObject({ id: 'test_1', last_done: '2026-06-06', next_due: '2026-09-04', overdue: true })
    expect(bp.days_until_due).toBe(-32)
  })

  it("counts Arun's inhaler in doses and his monthly capsule in whole days", async () => {
    const arun = await home('rp')
    const byId = Object.fromEntries(arun.medicines.map((m: { id: string }) => [m.id, m]))
    expect(byId.med_chronic_2).toMatchObject({
      stock: 20,
      unit: 'doses',
      days_of_cover: 10,
      runs_out_on: '2026-10-16',
    })
    expect(byId.med_chronic_3).toMatchObject({ stock: 3, days_of_cover: 90 })
    expect(arun.tests.map((t: { id: string; next_due: string }) => [t.id, t.next_due])).toEqual([
      ['test_2', '2027-07-18'],
      ['test_3', '2026-11-16'],
    ])
  })

  it('gives Kavya 15 days of Levothyroxine and her TSH due in December', async () => {
    const kavya = await home('member_3')
    expect(kavya.medicines[0]).toMatchObject({ days_of_cover: 15, runs_out_on: '2026-10-21' })
    expect(kavya.tests[0]).toMatchObject({ next_due: '2026-12-18', overdue: false, days_until_due: 73 })
  })

  it('has no agent word yet, and refuses an unknown member', async () => {
    expect((await home('patient')).latest_agent_word).toBeNull()
    const res = await request(app).get('/api/members/uncle/home').set('X-Member-Id', 'rp')
    expect(res.status).toBe(404)
  })
})
