import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { loadOnboarding } from '../src/config/onboarding.js'

const ob = loadOnboarding()

describe('GET /api/members', () => {
  it('lists the family with roles and languages, and no phone numbers', async () => {
    const res = await request(createApp({ onboarding: ob, clock: () => new Date(ob.sim_clock.start) })).get(
      '/api/members',
    )
    expect(res.status).toBe(200)
    expect(res.body.members).toEqual([
      { id: 'patient', name: 'Lakshmi', role: 'patient', language: 'te-IN' },
      { id: 'rp', name: 'Arun', role: 'responsible_person', language: 'en-IN' },
      { id: 'member_3', name: 'Kavya', role: 'family', language: 'en-IN' },
    ])
  })
})
