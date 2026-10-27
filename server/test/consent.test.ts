import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { loadOnboarding } from '../src/config/onboarding.js'
import { mayRecordCalls, shareLevel, viewLevel } from '../src/domain/consent.js'

const ob = loadOnboarding()

describe('consent per member', () => {
  it('reads what each member agreed to, per audience', () => {
    expect(shareLevel(ob, 'patient', 'rp')).toBe('full')
    expect(shareLevel(ob, 'patient', 'family_group')).toBe('status_only')
    expect(shareLevel(ob, 'patient', 'doctor')).toBe('full')
    expect(mayRecordCalls(ob, 'patient')).toBe(true)
  })

  it('shares nothing beyond status, and records no calls, for somebody with no entry', () => {
    const none = structuredClone(ob)
    delete none.consent.member_3
    expect(shareLevel(none, 'member_3', 'rp')).toBe('status_only')
    expect(mayRecordCalls(none, 'member_3')).toBe(false)
  })

  it('lets a member see their own record, the RP see it under share_with_rp, and others status only', () => {
    expect(viewLevel(ob, 'patient', 'patient')).toBe('full')
    expect(viewLevel(ob, 'patient', 'rp')).toBe('full')
    expect(viewLevel(ob, 'patient', 'member_3')).toBe('status_only')
  })

  it('follows a change of consent rather than a fixed rule', () => {
    const narrower = structuredClone(ob)
    narrower.consent.patient = {
      ...ob.consent.patient,
      share_with_rp: 'status_only',
      share_with_family_group: 'status_only',
      share_with_doctor: 'full',
      record_calls: true,
    }
    expect(viewLevel(narrower, 'patient', 'rp')).toBe('status_only')
  })
})

describe('the home route reads consent', () => {
  const app = createApp({ onboarding: ob, clock: () => new Date(ob.sim_clock.start) })
  const get = (id: string, viewer?: string) => {
    const req = request(app).get(`/api/members/${id}/home`)
    return viewer === undefined ? req : req.set('X-Member-Id', viewer)
  }

  it("gives Arun his mother's medicines in full", async () => {
    const res = await get('patient', 'rp')
    expect(res.body.shared).toBe('full')
    expect(res.body.medicines[0].name).toBe('Metoprolol')
  })

  it("gives Kavya her mother's status and no medicine or test", async () => {
    const res = await get('patient', 'member_3')
    expect(res.body).toMatchObject({
      shared: 'status_only',
      medicines: [],
      tests: [],
      latest_agent_word: null,
    })
    expect(JSON.stringify(res.body)).not.toMatch(/Metoprolol|BP check/)
  })

  it('refuses a request that does not say who is asking, or names a stranger', async () => {
    expect((await get('patient')).status).toBe(400)
    expect((await get('patient', 'uncle')).status).toBe(400)
  })
})
