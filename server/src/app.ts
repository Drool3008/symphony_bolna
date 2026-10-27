import express, { type Express } from 'express'
import type { Onboarding } from '@family-health/shared'

export interface AppContext {
  onboarding: Onboarding
}

export function createApp(ctx: AppContext): Express {
  const app = express()
  app.use(express.json({ limit: '5mb' }))

  /** The family with roles and languages. No phone numbers: those are for the agent's calls. */
  app.get('/api/members', (_req, res) => {
    res.json({
      members: ctx.onboarding.family.members.map(({ id, name, role, language }) => ({
        id,
        name,
        role,
        language,
      })),
    })
  })

  return app
}
