/**
 * The shape of config/onboarding.json: the family, their medicines and tests,
 * red flags, ranked providers, wallet, wait times, policy and the sim clock
 * start. Ported from the reference's config/onboarding.json, which had no
 * schema; every field here is one that file carries.
 *
 * Objects are strict, so a misspelt key, or a field from a removed rail, is a
 * readable error rather than something silently ignored. Keys that start with
 * an underscore are comments in the data (`_note`) and are dropped before the
 * shape is checked.
 */
import { z } from 'zod'

export const ROLES = ['patient', 'responsible_person', 'family'] as const
export type Role = (typeof ROLES)[number]

/** What each member agreed may be shared, per audience. The values the reference data uses. */
export const SHARE_LEVELS = ['full', 'status_only'] as const
export type ShareLevel = (typeof SHARE_LEVELS)[number]

export const TIERS = ['routine', 'urgent', 'critical'] as const
export type Tier = (typeof TIERS)[number]

const text = z.string().trim().min(1)
const id = text
const isoDate = z.iso.date()
const money = z.number().nonnegative()

export const MemberSchema = z.strictObject({
  id,
  name: text,
  role: z.enum(ROLES),
  age: z.number().int().positive(),
  /** BCP-47, e.g. te-IN. Every message to this person is written in it (R23). */
  language: z.string().regex(/^[a-z]{2,3}-[A-Z]{2}$/, 'a BCP-47 code such as te-IN'),
  phone: text,
  lives_in: text,
  lives_alone: z.boolean().optional(),
  relation: text.optional(),
  family_calls_her: text.optional(),
})

export const ConsentSchema = z.strictObject({
  share_with_rp: z.enum(SHARE_LEVELS),
  share_with_family_group: z.enum(SHARE_LEVELS),
  share_with_doctor: z.enum(SHARE_LEVELS),
  record_calls: z.boolean(),
})

export const KnownConditionSchema = z.strictObject({
  member: id,
  label: text,
  since: text,
  treated_by: text,
})

/**
 * A medicine counts its stock either in pills or, for an inhaler, in doses
 * with a unit. Exactly one of `pills_left` and `doses_left` is present.
 */
export const MedicineSchema = z
  .strictObject({
    id,
    member: id,
    name: text,
    strength: text,
    purpose: text,
    priority: z.enum(['low', 'medium', 'critical']),
    must_not_miss: z.boolean(),
    daily_dose: z.number().positive(),
    schedule: text,
    pills_left: z.number().int().nonnegative().optional(),
    doses_left: z.number().int().nonnegative().optional(),
    unit: text.optional(),
    prescribed_quantity: z.number().int().positive(),
    prescription_id: text,
    prescribed_by: text,
  })
  .refine((m) => (m.pills_left === undefined) !== (m.doses_left === undefined), {
    message: 'give exactly one of pills_left and doses_left',
  })

export const RecurringTestSchema = z.strictObject({
  id,
  member: id,
  name: text,
  every_days: z.number().int().positive(),
  last_done: isoDate,
  needed_for_prescription: text,
})

/** `for_member` absent means the provider serves the patient (reference onboarding, providers._note). */
export const ClinicSchema = z.strictObject({
  rank: z.number().int().positive(),
  name: text,
  doctor: text.optional(),
  phone: text,
  distance_km: z.number().nonnegative().optional(),
  treating_doctor: z.boolean().optional(),
  for_member: id.optional(),
})

export const ChemistSchema = z.strictObject({
  rank: z.number().int().positive(),
  name: text,
  phone: text,
  pincode: z.string().regex(/^\d{6}$/, 'a six-digit pincode'),
  for_member: id.optional(),
})

export const LabSchema = z.strictObject({
  rank: z.number().int().positive(),
  name: text,
  phone: text,
  distance_km: z.number().nonnegative().optional(),
})

export const ProvidersSchema = z.strictObject({
  clinics: z.array(ClinicSchema),
  chemists: z.array(ChemistSchema),
  labs: z.array(LabSchema),
  emergency: z.strictObject({ name: text, phone: text }),
})

export const WalletSettingsSchema = z.strictObject({
  limit_inr: money,
  spent_inr: money,
  /** A single spend above this stops and asks the RP first (R15). */
  major_spend_threshold_inr: money,
  /** Below this share of the limit the wallet is low (R16). */
  low_wallet_pct: z.number().min(0).max(100),
})

export const OnboardingSchema = z.strictObject({
  placeholder: z.boolean(),
  family: z.strictObject({
    name: text,
    pincode: z.string().regex(/^\d{6}$/, 'a six-digit pincode'),
    city: text,
    members: z.array(MemberSchema).min(1),
  }),
  /** Kept as a cross-check only: the chain is derived from roles (settled decision 2). */
  call_chain: z.strictObject({ order: z.array(id) }),
  consent: z.record(id, ConsentSchema),
  known_conditions: z.array(KnownConditionSchema),
  current_medicines: z.array(MedicineSchema),
  recurring_tests: z.array(RecurringTestSchema),
  red_flags: z.strictObject({ set_by: text, list: z.array(text).min(1) }),
  providers: ProvidersSchema,
  wallet: WalletSettingsSchema,
  wait_times_seconds: z.strictObject({
    critical: z.number().positive(),
    urgent: z.number().positive(),
    routine: z.number().positive(),
  }),
  policy: z.strictObject({
    clash_resolution: z.literal('rp_wins_log_both'),
    family_group_sharing: z.literal('status_only_ask_rp_before_sharing_summary'),
    unsure_assessment: z.literal('escalate_one_tier'),
    cant_tell: z.literal('treat_as_urgent_ask_human'),
  }),
  sim_clock: z.strictObject({ start: z.iso.datetime({ offset: true }) }),
})

export type Member = z.infer<typeof MemberSchema>
export type Consent = z.infer<typeof ConsentSchema>
export type KnownCondition = z.infer<typeof KnownConditionSchema>
export type Medicine = z.infer<typeof MedicineSchema>
export type RecurringTest = z.infer<typeof RecurringTestSchema>
export type Clinic = z.infer<typeof ClinicSchema>
export type Chemist = z.infer<typeof ChemistSchema>
export type Lab = z.infer<typeof LabSchema>
export type Providers = z.infer<typeof ProvidersSchema>
export type WalletSettings = z.infer<typeof WalletSettingsSchema>
export type Onboarding = z.infer<typeof OnboardingSchema>

/** Drops `_`-prefixed keys at every depth. They are comments in the data, not fields. */
export function stripComments(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripComments)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !key.startsWith('_'))
        .map(([key, v]) => [key, stripComments(v)]),
    )
  }
  return value
}
