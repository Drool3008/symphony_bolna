import type { ChatSendResponse, MembersResponse } from '@family-health/shared'
import express, { type Express } from 'express'
import { z } from 'zod'
import { deliverInput } from './agent/inbox.js'
import type { OperatorQueue } from './agent/operator.js'
import { actor } from './auth.js'
import { advanceClock, ClockError } from './clock.js'
import { OnboardingError } from './config/onboarding.js'
import { MEDIA_DIR } from './domain/history.js'
import { homeFor } from './domain/home.js'
import { streamEvents } from './events.js'
import { forwardRecord } from './forward.js'
import { bodyOf, errorHandler, HttpError } from './http.js'
import { resetSession } from './reset.js'
import type { Runtime } from './runtime.js'

export interface Services {
  operator: OperatorQueue
  /** Under the stub only: points the script at the path a sample trigger exercises. */
  selectScenario?: (sampleId: string | undefined) => string | null
}

export function createApp(rt: Runtime, services: Services): Express {
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
   * and that is all: family chat never reaches the agent (R2). The one
   * exception is explicit: in the family group, where the agent is a member,
   * a line addressed to it with @agent is a real input from a real person.
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

    if (message.to_agent) {
      const name = rt.onboarding().family.members.find((m) => m.id === memberId)?.name ?? memberId
      // If the agent is waiting on this person, or on the group, it is their answer.
      if (
        rt.waits.reply(memberId, message.text, null) ||
        rt.waits.reply(chat_id, `${name}: ${message.text}`, null)
      )
        return
      deliverInput(rt, {
        kind: 'message',
        source: `${name}, in the family group, addressed to the agent`,
        from: memberId,
        via: chat_id,
        text: message.text,
      })
    }
  })

  /** A member forwards a record to the agent: the only way a family document reaches it (R2). */
  app.post('/api/forward', (req, res) => {
    const { memberId } = actor(rt, req)
    forwardRecord(rt, memberId, bodyOf(ForwardBody, req))
    res.json({ ok: true })
  })

  /**
   * A member writes to the agent in their own thread: a real input, labelled
   * with who sent it and where. Also kept in their thread so their screen
   * shows what they sent, not just the agent's side.
   */
  app.post('/api/input', (req, res) => {
    const { memberId } = actor(rt, req)
    // sample_id says which canned sentence a client offered. It picks the
    // stub's script and is never put on the input: a real model must not see
    // the tier the sample expects (settled decision 1).
    const { text, sample_id } = bodyOf(InputBody, req)
    const picked = services.selectScenario?.(sample_id) ?? null
    if (picked)
      rt.emit('scenario_selected', {
        sample_id,
        script: picked,
        note: 'stub only; the agent was told nothing',
      })
    const name = rt.onboarding().family.members.find((m) => m.id === memberId)?.name ?? memberId
    rt.threads.post({ thread: memberId, from: memberId, to: 'agent', text })
    // Typing routes itself: a reply if the agent is waiting on this person,
    // otherwise a new input (reference README, the member app).
    if (rt.waits.reply(memberId, text, null)) {
      res.json({ ok: true, as: 'reply' })
      return
    }
    deliverInput(rt, { kind: 'message', source: `${name}, in the chat with the agent`, from: memberId, text })
    res.json({ ok: true, as: 'input' })
  })

  /**
   * A person answers: a button on a card, or a typed reply. The answer is
   * locked onto the card so every screen shows the same thing, and it ends
   * the agent's wait on them, if there is one.
   */
  app.post('/api/reply', (req, res) => {
    const { memberId } = actor(rt, req)
    const { text, action, message_id } = bodyOf(ReplyBody, req)
    if (message_id) {
      const card = rt.threads.find(message_id)
      if (!card || card.thread !== memberId || !card.card)
        throw new HttpError(404, 'no card for you with that id')
      if (!rt.threads.answerCard(message_id, action ?? text ?? ''))
        throw new HttpError(409, 'that card is already answered')
    }
    rt.threads.post({
      thread: memberId,
      from: memberId,
      to: 'agent',
      text: text ?? action ?? '',
      kind: 'reply',
    })
    res.json({ ok: true, delivered: rt.waits.reply(memberId, text ?? null, action ?? null) })
  })

  /** Whoever is playing the phone says this person did not pick up. */
  app.post('/api/no-answer', (req, res) => {
    const { from } = bodyOf(NoAnswerBody, req)
    rt.emit('no_answer', { from, source: 'operator' })
    res.json({ ok: true, delivered: rt.waits.noAnswer(from) })
  })

  /** Calls a person or a fixture answers, waiting (replaces the reference's /api/curtain). */
  app.get('/api/operator/queue', (_req, res) => {
    res.json({ pending: services.operator.pending() })
  })

  app.post('/api/operator/queue/:id', (req, res) => {
    res.json({ item: services.operator.respond(req.params.id, bodyOf(OperatorAnswerBody, req)) })
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
      // A date reached is a trigger, with the clock as its source.
      if (reached.length) deliverInput(rt, { kind: 'clock', source: `Clock: ${move.source}`, reached })
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

const InputBody = z.object({
  text: z.string().trim().min(1, 'say something'),
  sample_id: z.string().optional(),
})

const ReplyBody = z
  .object({
    text: z.string().trim().min(1).optional(),
    action: z.string().trim().min(1).optional(),
    message_id: z.string().optional(),
  })
  .refine((b) => b.text !== undefined || b.action !== undefined, {
    message: 'say something, or press a button',
  })

const NoAnswerBody = z.object({ from: z.string().trim().min(1) })

const OperatorAnswerBody = z.object({
  variant: z.string().optional(),
  response: z.record(z.string(), z.unknown()).optional(),
})

const ChatSendBody = z.object({
  chat_id: z.string().trim().min(1),
  text: z.string().trim().min(1, 'say something'),
  ask_agent: z.boolean().optional(),
})

const ForwardBody = z.object({
  chat_id: z.string().trim().min(1),
  message_id: z.string().trim().min(1),
  caption: z.string().optional(),
  note: z.string().optional(),
})

const ResetBody = z.object({ reason: z.string().trim().min(1).optional() })

const ClockBody = z.object({
  to: z.iso.datetime({ offset: true }).optional(),
  to_next_date: z.boolean().optional(),
  source: z.string().trim().min(1, 'say who or what moved the clock'),
})
