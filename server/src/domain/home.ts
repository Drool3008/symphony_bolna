import type { MemberHomeResponse, Onboarding } from '@family-health/shared'
import { viewLevel } from './consent.js'
import { calendarDate, offsetMinutes } from './dates.js'
import { coverOf } from './medicines.js'
import { dueOf } from './recurring-tests.js'

/**
 * One member's medicines with days left and tests with next due, against the
 * sim clock, as `viewer` is allowed to see them. Status only means no
 * medicine, no test and no agent word: who it is about and nothing medical.
 * Null for an unknown id.
 */
export function homeFor(
  ob: Onboarding,
  memberId: string,
  clock: Date,
  viewer: string,
): MemberHomeResponse | null {
  const member = ob.family.members.find((m) => m.id === memberId)
  if (!member) return null
  const today = calendarDate(clock, offsetMinutes(ob.sim_clock.start))
  const shared = viewLevel(ob, memberId, viewer)
  const base = {
    member: { id: member.id, name: member.name, role: member.role, language: member.language },
    clock: clock.toISOString(),
    today,
    shared,
  }
  if (shared === 'status_only') return { ...base, medicines: [], tests: [], latest_agent_word: null }

  return {
    ...base,
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
