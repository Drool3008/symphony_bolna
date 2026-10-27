import type { Chemist, Clinic, Lab, Onboarding } from '@family-health/shared'

/**
 * The ranked clinics, chemists and labs from onboarding. Ported from the
 * reference's server/acting.js (providersOf). There is no courier and no
 * payment rail on any provider: a chemist delivers or the medicine is
 * collected, and money is a ledger entry.
 */
export const PROVIDER_KINDS = ['clinics', 'chemists', 'labs'] as const
export type ProviderKind = (typeof PROVIDER_KINDS)[number]

export interface ProviderByKind {
  clinics: Clinic
  chemists: Chemist
  labs: Lab
}

/** Best first. */
export function ranked<K extends ProviderKind>(ob: Onboarding, kind: K): ProviderByKind[K][] {
  const list = ob.providers[kind] as ProviderByKind[K][]
  return [...list].sort((a, b) => a.rank - b.rank)
}

/**
 * Who a provider serves. Absent means the patient: the reference onboarding
 * says so in its providers note, and every provider without the field is
 * near Lakshmi.
 */
export function servedMember(ob: Onboarding, provider: Clinic | Chemist | Lab): string | null {
  if ('for_member' in provider && provider.for_member) return provider.for_member
  return ob.family.members.find((m) => m.role === 'patient')?.id ?? null
}

/** The ranked list for one member: their own providers, best first. */
export function rankedFor<K extends ProviderKind>(
  ob: Onboarding,
  kind: K,
  memberId: string,
): ProviderByKind[K][] {
  return ranked(ob, kind).filter((p) => servedMember(ob, p) === memberId)
}

/** Letters and digits only, so "Kazipet pharmacy." still finds "Kazipet Pharmacy" (reference acting.js, squash). */
const squash = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

/** A provider named in the data, or null. Never a provider that is not on file. */
export function findProvider<K extends ProviderKind>(
  ob: Onboarding,
  kind: K,
  name: string,
): ProviderByKind[K] | null {
  return ranked(ob, kind).find((p) => squash(p.name) === squash(name)) ?? null
}

export const emergencyService = (ob: Onboarding) => ob.providers.emergency
