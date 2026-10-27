import express, { type Express } from 'express'
import type { MembersResponse, Onboarding } from '@family-health/shared'
import { homeFor } from './domain/home.js'

export interface AppContext {
  onboarding: Onboarding
  /** The simulated clock. Until the clock is stored, it stands at the onboarding start. */
  clock: () => Date
}

export function createApp(ctx: AppContext): Express {
  const app = express()
  app.use(express.json({ limit: '5mb' }))

  /** The family with roles and languages. No phone numbers: those are for the agent's calls. */
  app.get('/api/members', (_req, res) => {
    const body: MembersResponse = {
      members: ctx.onboarding.family.members.map(({ id, name, role, language }) => ({
        id,
        name,
        role,
        language,
      })),
    }
    res.json(body)
  })

  /** Medicines with days left and tests with next due, computed against the sim clock. */
  app.get('/api/members/:id/home', (req, res) => {
    const home = homeFor(ctx.onboarding, req.params.id, ctx.clock())
    if (!home) {
      res.status(404).json({ error: `no family member with id ${req.params.id}` })
      return
    }
    res.json(home)
  })

  return app
}
