import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { testApp } from './helpers.js'

describe('GET /api/members', () => {
  it('lists the family with roles and languages, and no phone numbers', async () => {
    const res = await request(testApp().app).get('/api/members')
    expect(res.status).toBe(200)
    expect(res.body.members).toEqual([
      { id: 'patient', name: 'Lakshmi', role: 'patient', language: 'te-IN' },
      { id: 'rp', name: 'Arun', role: 'responsible_person', language: 'en-IN' },
      { id: 'member_3', name: 'Kavya', role: 'family', language: 'en-IN' },
    ])
  })
})
