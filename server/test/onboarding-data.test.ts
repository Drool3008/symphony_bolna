import { readFileSync } from 'node:fs'
import { OnboardingSchema, stripComments } from '@family-health/shared'
import { describe, expect, it } from 'vitest'

const raw = JSON.parse(readFileSync(new URL('../../config/onboarding.json', import.meta.url), 'utf8'))

describe('the family on file', () => {
  const onboarding = OnboardingSchema.parse(stripComments(raw))

  it('is Lakshmi, Arun and Kavya, with their roles and languages', () => {
    expect(onboarding.family.members.map((m) => [m.id, m.name, m.role, m.language])).toEqual([
      ['patient', 'Lakshmi', 'patient', 'te-IN'],
      ['rp', 'Arun', 'responsible_person', 'en-IN'],
      ['member_3', 'Kavya', 'family', 'en-IN'],
    ])
  })

  it('counts the inhaler in doses and the tablets in pills', () => {
    const byId = Object.fromEntries(onboarding.current_medicines.map((m) => [m.id, m]))
    expect(byId.med_chronic_1).toMatchObject({ pills_left: 6, daily_dose: 2, must_not_miss: true })
    expect(byId.med_chronic_2).toMatchObject({ doses_left: 20, unit: 'doses' })
  })

  it('carries no payment rail on the wallet and no courier flag on any chemist', () => {
    expect(
      Object.keys(raw.wallet)
        .filter((k) => !k.startsWith('_'))
        .sort(),
    ).toEqual(['limit_inr', 'low_wallet_pct', 'major_spend_threshold_inr', 'spent_inr'])
    for (const chemist of raw.providers.chemists) {
      expect(Object.keys(chemist).sort()).toEqual(['for_member', 'name', 'phone', 'pincode', 'rank'])
    }
  })

  it('drops comment keys before checking the shape', () => {
    expect(raw._note).toBeTypeOf('string')
    expect(stripComments(raw)).not.toHaveProperty('_note')
  })
})
