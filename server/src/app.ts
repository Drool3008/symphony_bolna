import express, { type Express, type Request } from 'express'
import type { MembersResponse } from '@family-health/shared'
import { MEDIA_DIR } from './domain/history.js'
import { streamEvents } from './events.js'
import { homeFor } from './domain/home.js'

import type { Runtime } from './runtime.js'

export function createApp(rt: Runtime): Express {
  const app = express()

  /**
   * The member making the request, from X-Member-Id, checked against
   * onboarding. There is no auth in this pass; this says who is asking, it
   * does not prove it.
   */
  const actingMember = (req: Request): string | null => {
    const id = req.get('X-Member-Id')
    return id && rt.onboarding().family.members.some((m) => m.id === id) ? id : null
  }
  app.use(express.json({ limit: '5mb' }))

  app.get('/events', (req, res) => streamEvents(rt, req, res))

  /** Seeded, fictional records, at the paths the chat history points to. */
  app.use('/media', express.static(MEDIA_DIR))

  /** The family with roles and languages. No phone numbers: those are for the agent's calls. */
  app.get('/api/members', (_req, res) => {
    const body: MembersResponse = {
      members: rt.onboarding().family.members.map(({ id, name, role, language }) => ({
        id,
        name,
        role,
        language,
      })),
    }
    res.json(body)
  })

  /**
   * Medicines with days left and tests with next due, computed against the
   * sim clock, as much as the asking member's view of this person allows.
   */
  app.get('/api/members/:id/home', (req, res) => {
    const viewer = actingMember(req)
    if (!viewer) {
      res.status(400).json({ error: 'X-Member-Id must name a family member' })
      return
    }
    const home = homeFor(rt.onboarding(), req.params.id, rt.clock(), viewer)
    if (!home) {
      res.status(404).json({ error: `no family member with id ${req.params.id}` })
      return
    }
    res.json(home)
  })

  return app
}
