import type { HomeMedicine, HomeTest } from '@family-health/shared'

/**
 * What a tap on home says to the agent, in the reference's words
 * (../super-duper-engine-reference/src/PhoneApp.tsx, Home). It goes through
 * POST /api/input as `{ text }` only: the server takes `text` and
 * `sample_id`, and this client has no sample ids. The wording stays English
 * for every member, as the reference sent it; the agent answers in the
 * member's language.
 */
export function refillText(m: HomeMedicine, ownerName: string): string {
  return `Please refill ${m.name} ${m.strength} for ${ownerName}`
}

export function bookText(t: HomeTest): string {
  return `Please book my ${t.name}.`
}

/**
 * Low stock is the reference's presentation, not a server rule: five days of
 * cover or fewer turns the chip red, and the bar fills against thirty days
 * (src/PhoneApp.tsx). Both read the server's `days_of_cover`.
 */
export const isLow = (m: HomeMedicine) => m.days_of_cover <= 5

export const coverWidth = (m: HomeMedicine) => `${Math.max(4, Math.min(100, (m.days_of_cover / 30) * 100))}%`
