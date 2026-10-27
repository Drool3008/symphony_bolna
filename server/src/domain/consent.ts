import type { Onboarding, ShareLevel } from '@family-health/shared'

/**
 * What each adult agreed may be shared about them, and with whom. Set at
 * onboarding (stage 0) in the reference's config/onboarding.json `consent`
 * block; the reference stored it and nothing read it. Everything that shares
 * a member's record asks here first.
 */
export const AUDIENCES = ['rp', 'family_group', 'doctor'] as const
export type Audience = (typeof AUDIENCES)[number]

const FIELD = {
  rp: 'share_with_rp',
  family_group: 'share_with_family_group',
  doctor: 'share_with_doctor',
} as const

/** How much of `subject`'s record may go to an audience. A member with no entry shares status only. */
export function shareLevel(ob: Onboarding, subject: string, audience: Audience): ShareLevel {
  return ob.consent[subject]?.[FIELD[audience]] ?? 'status_only'
}

/** Whether calls with this member may be recorded. No entry means no. */
export const mayRecordCalls = (ob: Onboarding, member: string): boolean =>
  ob.consent[member]?.record_calls ?? false

/**
 * How much of `subject`'s record one member may see. Your own record in full;
 * the responsible person under `share_with_rp`; anybody else in the family
 * under `share_with_family_group`, the same as the group thread.
 */
export function viewLevel(ob: Onboarding, subject: string, viewer: string): ShareLevel {
  if (viewer === subject) return 'full'
  const isRp = ob.family.members.some((m) => m.id === viewer && m.role === 'responsible_person')
  return shareLevel(ob, subject, isRp ? 'rp' : 'family_group')
}
