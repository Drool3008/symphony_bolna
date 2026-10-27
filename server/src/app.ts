import type { ChatSendResponse, MembersResponse } from '@family-health/shared'
import express, { type Express } from 'express'
import { z } from 'zod'
import { actor } from './auth.js'
import { advanceClock, ClockError } from './clock.js'
import { OnboardingError } from './config/onboarding.js'
import { MEDIA_DIR } from './domain/history.js'
import { homeFor } from './domain/home.js'
import { streamEvents } from './events.js'
import { bodyOf, errorHandler, HttpError } from './http.js'
import { resetSession } from './reset.js'
import type { Runtime } from './runtime.js'

export function createApp(rt: Runtime): Express {
  const app = express()
  app.use(express.json({ limit: '5mb' }))

  app.get('/events', (req, res) => streamEvents(rt, req, res))

  /** Seeded, fictional records, at the paths the chat history points to. */
  app.use('/media', express.static(MEDIA_DIR))

  /** The family with roles and languages. No phone numbers: those are for the agent's calls. */
  app.get('/api/members', (_req, res) => {
    const body: MembersResponse = {
      members: rt
        .onboarding()
        .family.members.map(({ id, name, role, language }) => ({ id, name, role, language })),
    }
    res.json(body)
  })

  /**
   * Medicines with days left and tests with next due, computed against the
   * sim clock, as much as the asking member's view of this person allows.
   */
  app.get('/api/members/:id/home', (req, res) => {
    const { memberId } = actor(rt, req)
    const home = homeFor(rt.onboarding(), req.params.id, rt.clock(), memberId)
    if (!home) throw new HttpError(404, `no family member with id ${req.params.id}`)
    res.json(home)
  })

  /**
   * A member types into a family chat. Stored and sent to the other handsets,
   * and that is all: family chat never reaches the agent (R2).
   */
  app.post('/api/chat/send', (req, res) => {
    const { memberId } = actor(rt, req)
    const { chat_id, text, ask_agent } = bodyOf(ChatSendBody, req)
    const isMember = rt.onboarding().family.members.some((m) => m.id === chat_id)
    if (!rt.chats.isGroup(chat_id) && !isMember)
      throw new HttpError(400, `${chat_id} is not a chat in this family`)
    if (chat_id === memberId) throw new HttpError(400, 'a direct chat is with somebody else')
    if (ask_agent && !rt.chats.isGroup(chat_id))
      throw new HttpError(400, '@agent works in the family group only')

    const message = rt.chats.post({ from: memberId, chatId: chat_id, text, toAgent: Boolean(ask_agent) })
    const body: ChatSendResponse = { key: message.key, message }
    res.json(body)
  })

  /**
   * A person moves the sim clock forward, or moves it to the agent's next
   * date. Never on a timer. The response lists the agent's dates it reached.
   */
  app.post('/api/clock', (req, res) => {
    const move = bodyOf(ClockBody, req)
    try {
      const { clock, reached } = advanceClock(rt, move)
      res.json({ clock: clock.toISOString(), reached })
    } catch (err) {
      if (err instanceof ClockError) throw new HttpError(400, err.message)
      throw err
    }
  })

  /** A fresh run. Onboarding is reread from disk; a file that cannot be used changes nothing. */
  app.post('/api/reset', (req, res) => {
    const { reason } = bodyOf(ResetBody, req)
    try {
      res.json(resetSession(rt, reason ?? 'operator reset'))
    } catch (err) {
      if (err instanceof OnboardingError) throw new HttpError(422, err.message)
      throw err
    }
  })

  app.use(errorHandler)
  return app
}

const ChatSendBody = z.object({
  chat_id: z.string().trim().min(1),
  text: z.string().trim().min(1, 'say something'),
  ask_agent: z.boolean().optional(),
})

const ResetBody = z.object({ reason: z.string().trim().min(1).optional() })

const ClockBody = z.object({
  to: z.iso.datetime({ offset: true }).optional(),
  to_next_date: z.boolean().optional(),
  source: z.string().trim().min(1, 'say who or what moved the clock'),
})
