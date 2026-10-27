import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { actor } from '../src/auth.js'
import { errorHandler } from '../src/http.js'
import { testRuntime } from './helpers.js'

/** A route guarded the way the wallet and reversal routes will be. */
function guarded() {
  const rt = testRuntime()
  const app = express()
  app.get('/rp-only', (req, res) => {
    res.json(actor(rt, req, { role: 'responsible_person', to: 'change the wallet' }))
  })
  app.get('/anyone', (req, res) => {
    res.json(actor(rt, req))
  })
  app.use(errorHandler)
  return app
}

describe('who is asking', () => {
  it('names the member and their role from X-Member-Id', async () => {
    const res = await request(guarded()).get('/anyone').set('X-Member-Id', 'member_3')
    expect(res.body).toEqual({ memberId: 'member_3', role: 'family' })
  })

  it('refuses a request that names nobody, or somebody not in the family', async () => {
    expect((await request(guarded()).get('/anyone')).status).toBe(400)
    expect((await request(guarded()).get('/anyone').set('X-Member-Id', 'uncle')).status).toBe(400)
  })

  it('refuses the wrong role, and says what was refused', async () => {
    const no = await request(guarded()).get('/rp-only').set('X-Member-Id', 'patient')
    expect(no.status).toBe(403)
    expect(no.body.error).toBe('only the responsible person may ask to change the wallet')
    expect((await request(guarded()).get('/rp-only').set('X-Member-Id', 'rp')).status).toBe(200)
  })
})
