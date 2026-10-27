import type { AgentDate, Onboarding } from '@family-health/shared'
import { calendarDate, offsetMinutes, type CalendarDate } from './domain/dates.js'
import { coverOf } from './domain/medicines.js'
import { dueOf } from './domain/recurring-tests.js'
import type { Runtime } from './runtime.js'

/**
 * The simulated clock. It moves only when a person moves it or it is moved to
 * one of the agent's own dates, never on a wall-clock timer: a timer would be
 * the backend deciding that time had passed (reference server/index.js
 * POST /api/clock, server/humans.js). Waits and reversal windows close when it
 * passes their deadline.
 */

export type ClockListener = (now: Date, before: Date) => void

/** The dates the agent watches, in date order: medicines running out and tests falling due. */
export function agentDates(ob: Onboarding, now: Date): AgentDate[] {
  const offset = offsetMinutes(ob.sim_clock.start)
  const today = calendarDate(now, offset)
  const asOf = calendarDate(new Date(ob.sim_clock.start), offset)
  const dates: AgentDate[] = [
    ...ob.current_medicines.map((m) => ({
      kind: 'medicine_runs_out' as const,
      id: m.id,
      member: m.member,
      date: coverOf(m, today, asOf).runs_out_on,
    })),
    ...ob.recurring_tests.map((t) => ({
      kind: 'test_due' as const,
      id: t.id,
      member: t.member,
      date: dueOf(t, today).next_due,
    })),
  ]
  return dates.sort((a, b) => a.date.localeCompare(b.date))
}

/** The start of a calendar date on the family's clock. */
function startOf(ob: Onboarding, date: CalendarDate): Date {
  const offset = offsetMinutes(ob.sim_clock.start)
  return new Date(Date.parse(`${date}T00:00:00Z`) - offset * 60_000)
}

export class ClockError extends Error {}

export function advanceClock(
  rt: Runtime,
  move: { to?: string | undefined; to_next_date?: boolean | undefined; source: string },
): { clock: Date; reached: AgentDate[] } {
  const ob = rt.onboarding()
  const before = rt.clock()
  const today = calendarDate(before, offsetMinutes(ob.sim_clock.start))

  let to: Date
  if (move.to_next_date) {
    const next = agentDates(ob, before).find((d) => d.date > today)
    if (!next) throw new ClockError('there is no date ahead of the clock to move to')
    to = startOf(ob, next.date)
  } else if (move.to) {
    to = new Date(move.to)
    if (Number.isNaN(to.getTime())) throw new ClockError('to must be an ISO timestamp')
  } else {
    throw new ClockError('say where the clock goes: to, or to_next_date')
  }
  // Proposal: the clock never runs backwards. A wait or a window that closed
  // must not reopen because somebody typed an earlier date.
  if (to.getTime() < before.getTime()) {
    throw new ClockError(`the clock does not go backwards: it is ${before.toISOString()}`)
  }

  const after = calendarDate(to, offsetMinutes(ob.sim_clock.start))
  const reached = agentDates(ob, before).filter((d) => d.date > today && d.date <= after)

  rt.session.set('clock', to.toISOString())
  rt.emit('clock', { clock: to.toISOString(), source: move.source, reached })
  rt.clockMoved(to, before)
  return { clock: to, reached }
}
