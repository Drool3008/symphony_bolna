import type { MemberHomeResponse, Onboarding } from '@family-health/shared'
import { calendarDate, offsetMinutes } from './dates.js'
import { coverOf } from './medicines.js'
import { dueOf } from './recurring-tests.js'

/** One member's medicines with days left and tests with next due, against the sim clock. Null for an unknown id. */
export function homeFor(ob: Onboarding, memberId: string, clock: Date): MemberHomeResponse | null {
  const member = ob.family.members.find((m) => m.id === memberId)
  if (!member) return null
  const today = calendarDate(clock, offsetMinutes(ob.sim_clock.start))

  return {
    member: { id: member.id, name: member.name, role: member.role, language: member.language },
    clock: clock.toISOString(),
    today,
    medicines: ob.current_medicines
      .filter((m) => m.member === memberId)
      .map((m) => ({
        id: m.id,
        name: m.name,
        strength: m.strength,
        purpose: m.purpose,
        schedule: m.schedule,
        must_not_miss: m.must_not_miss,
        ...coverOf(m, today),
      })),
    tests: ob.recurring_tests
      .filter((t) => t.member === memberId)
      .map((t) => ({
        id: t.id,
        name: t.name,
        every_days: t.every_days,
        last_done: t.last_done,
        ...dueOf(t, today),
      })),
    latest_agent_word: null,
  }
}
