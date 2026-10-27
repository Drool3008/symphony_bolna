import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { loadOnboarding } from '../src/config/onboarding.js'
import { fromRoot } from '../src/config/paths.js'
import { loadFamilyHistory, loadRpHistory, MEDIA_DIR } from '../src/domain/history.js'

const ob = loadOnboarding()
const memberIds = new Set(ob.family.members.map((m) => m.id))
const history = loadFamilyHistory()

describe('the seeded history', () => {
  it('is written only by members of this family, and the agent in the RP history', () => {
    for (const chat of history.chats) for (const m of chat.messages) expect(memberIds).toContain(m.from)
    for (const m of loadRpHistory().messages) expect(['agent', ...memberIds]).toContain(m.from)
  })

  it('points only at media that is on disk', () => {
    const paths = history.chats.flatMap((c) =>
      c.messages.flatMap((m) => (m.media ? [m.media.src, m.media.thumb].filter(Boolean) : [])),
    ) as string[]
    expect(paths.length).toBeGreaterThan(0)
    for (const p of paths) expect(existsSync(join(MEDIA_DIR, p.replace(/^\/media\//, '')))).toBe(true)
  })

  it('serves that media at the same path', async () => {
    const app = createApp({ onboarding: ob, clock: () => new Date(ob.sim_clock.start) })
    const res = await request(app).get('/media/rx-patient.png')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toBe('image/png')
  })

  it('keeps demo reports for each of the three, as PDFs', () => {
    for (const who of ['lakshmi', 'arun', 'kavya']) {
      const files = readdirSync(fromRoot(`reports/${who}`))
      expect(files.length).toBeGreaterThan(0)
      for (const f of files) expect(f).toMatch(/^\d{4}-\d{2}-\d{2}_[a-z0-9-]+\.pdf$/)
    }
  })
})
