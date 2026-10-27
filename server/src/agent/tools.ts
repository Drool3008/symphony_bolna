import type { Onboarding } from '@family-health/shared'
import { z } from 'zod'
import type { Runtime } from '../runtime.js'
import { DecisionLog } from '../store/decisions.js'
import type { ToolDeclaration } from './providers/types.js'
import { defineTool, type ToolSpec } from './tool.js'

/**
 * The tool catalogue: one zod schema per tool, from which both the argument
 * check and every provider's declaration are made (reference server/tools.js,
 * which kept a hand-written schema per provider shape). Descriptions are the
 * reference's, with the removed rails taken out.
 *
 * Tools land with the stage that builds them; this is the set the loop and its
 * guards need.
 */

const line = (what: string) => z.string().trim().min(1).describe(what)

/** Who a message can go to: a family member by id, the family group, or the doctor. */
function recipients(ob: Onboarding) {
  const ids = ob.family.members.map((m) => m.id)
  const values: string[] = [...ids, 'family_group', 'doctor']
  return z.enum(values as [string, ...string[]])
}

/** Every number the onboarding data holds. A call to anything else is refused. */
function knownNumbers(ob: Onboarding): Set<string> {
  const p = ob.providers
  return new Set([
    ...ob.family.members.map((m) => m.phone),
    ...p.clinics.map((c) => c.phone),
    ...p.chemists.map((c) => c.phone),
    ...p.labs.map((l) => l.phone),
    p.emergency.phone,
  ])
}

const RECORD_LISTS = {
  medicine: 'current_medicines',
  refill_date: 'current_medicines',
  prescription: 'current_medicines',
  test_schedule: 'recurring_tests',
  contact: 'members',
} as const

export function buildTools(rt: Runtime): ToolSpec[] {
  const ob = rt.onboarding()
  const decisions = new DecisionLog(rt)

  return [
    defineTool({
      name: 'log_decision',
      mode: 'LIVE',
      description:
        'Record one choice BEFORE acting on it. Required before every other tool call in the same step (R19). This is the record the family and the doctor read later.',
      schema: z.object({
        received: line('What you received, in plain words'),
        source: line(
          'Where it came from: who or what, and through what channel. e.g. "Patient, voice note in the app" or "Clock, refill date from RX-4412"',
        ),
        decided: line('What you decided to do'),
        rule_id: line('The rule this follows, e.g. R15'),
        why: line('One line. For an assessment, name the factors you weighed.'),
        action: line('What you did or said, verbatim if it was a message'),
        recipient: line('Who it went to, or "none"'),
        connector: line(
          'Through what: in-app message, phone, speech port, wallet ledger, Beckn, Sheets, or "none"',
        ),
      }),
      handler: (args) => {
        const row = decisions.record(args)
        return { ok: true, row_number: row.seq }
      },
    }),

    defineTool({
      name: 'set_stage',
      mode: 'LIVE',
      description:
        'Move to a stage, 0 to 9. Stage 7 Checking in runs alongside 3 to 9 and does not replace them.',
      schema: z.object({
        stage: z
          .number()
          .int()
          .min(0)
          .max(9)
          .describe(
            '0 Onboarding, 1 Idle, 2 Triggered, 3 Reaching, 4 Listening, 5 Assessing, 6 Acting, 7 Checking in, 8 Handing over, 9 Closing',
          ),
        why: line('One line'),
      }),
      handler: ({ stage, why }) => {
        rt.session.set('stage', stage)
        rt.emit('stage', { stage, why })
        return { ok: true, stage }
      },
    }),

    defineTool({
      name: 'send_message',
      mode: 'LIVE',
      description:
        "Send a message. The family group gets status only, never medical detail (R18). Use the recipient's own language (R23).",
      schema: z.object({
        to: recipients(ob).describe('Recipient'),
        text: line("The message, in the recipient's language"),
        language: line('BCP-47 code you wrote it in, e.g. te-IN'),
        card: z
          .string()
          .optional()
          .describe(
            'Optional. JSON string for an interactive card the person taps to answer. ' +
              'kind is one of: spend_above_threshold, new_doctor, new_medicine, disagreement, cant_tell, low_wallet, ' +
              'dead_end, substitute_offered, incident_summary, payment, booking, test_due, slot_unavailable. ' +
              'Optional fields: title, detail, amount_inr, payee, wallet_left_inr, medicine, strength, quantity, test, ' +
              'doctor, clinic, when, for (who it is for; name these on any spend card), why (one line in plain ' +
              'language, no rule IDs, the person never sees those), options (array of {label,value} for side-by-side ' +
              'views such as a disagreement), buttons (array of labels), on_timeout (what you will do if nobody answers). ' +
              'incident_summary takes no buttons. slot_unavailable gives the person their real choices -- another named ' +
              'doctor from the onboarding data, the same doctor later, or not booking -- and never picks for them.',
          ),
      }),
      handler: ({ to, text, language, card }) => {
        let parsed: Record<string, unknown> | null = null
        if (card !== undefined) {
          try {
            parsed = JSON.parse(card) as Record<string, unknown>
          } catch {
            return { ok: false, error: 'card must be a JSON object written as a string' }
          }
        }
        const message = rt.threads.post({ thread: to, from: 'agent', to, text, language, card: parsed })
        return { ok: true, delivered_to: to, message_id: message.id }
      },
    }),

    defineTool({
      name: 'record_update',
      mode: 'LIVE',
      description:
        'Update the family record: a medicine schedule, a refill date, a contact, a prescription or a test schedule (R21).',
      schema: z.object({
        target: z
          .enum(['medicine', 'refill_date', 'contact', 'prescription', 'test_schedule'])
          .describe('What to update'),
        id: line('Which record, e.g. med_chronic_1'),
        changes: line('JSON object of the fields to change, as a string'),
        why: line('One line'),
      }),
      handler: ({ target, id, changes, why }) => {
        let fields: Record<string, unknown>
        try {
          fields = JSON.parse(changes) as Record<string, unknown>
        } catch {
          return { ok: false, error: 'changes must be a JSON object written as a string' }
        }
        if ('id' in fields || 'member' in fields)
          return { ok: false, error: 'a record keeps its id and whose it is' }

        const next = structuredClone(rt.onboarding())
        const list: { id: string }[] =
          RECORD_LISTS[target] === 'members' ? next.family.members : next[RECORD_LISTS[target]]
        const row = list.find((r) => r.id === id)
        if (!row) return { ok: false, error: `no ${target} record with id ${id}` }
        Object.assign(row, fields)
        try {
          rt.setOnboarding(next)
        } catch (err) {
          return { ok: false, error: (err as Error).message }
        }
        rt.emit('record_update', { target, id, changes: fields, why })
        return { ok: true, target, id, applied: fields }
      },
    }),

    defineTool({
      name: 'place_call',
      mode: 'PERSON',
      fixtures: 'phone/place_call',
      description:
        'Place a phone call to a person or an organisation: a family member, a clinic, a lab, a chemist, or 108. ' +
        'A person plays whoever answers. The reply comes back as what they said; spoken replies go through the speech port.',
      schema: z.object({
        to: line('Who you are calling: a name from the onboarding data, or 108'),
        phone: line('The number from the onboarding data'),
        purpose: line('Why you are calling, in one line'),
        say: line('What you say when they pick up, in their language'),
      }),
      check: ({ phone }) =>
        knownNumbers(rt.onboarding()).has(phone)
          ? undefined
          : {
              ok: false,
              error: `${phone} is not a number in the onboarding data. Never invent a phone number.`,
            },
    }),
  ] as ToolSpec[]
}

/** Each tool as the model is told about it: the zod schema as JSON Schema. */
export function declarations(tools: ToolSpec[]): ToolDeclaration[] {
  return tools.map((t) => {
    const { $schema: _drop, ...parameters } = z.toJSONSchema(t.schema, { io: 'input' }) as Record<
      string,
      unknown
    >
    return { name: t.name, description: t.description, parameters }
  })
}
