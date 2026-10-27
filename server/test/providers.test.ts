import { describe, expect, it } from 'vitest'
import { loadOnboarding } from '../src/config/onboarding.js'
import { emergencyService, findProvider, ranked, rankedFor } from '../src/domain/providers.js'

const ob = loadOnboarding()
const names = (list: { name: string }[]) => list.map((p) => p.name)

describe('ranked providers', () => {
  it('lists each kind best first', () => {
    const shuffled = structuredClone(ob)
    shuffled.providers.chemists.reverse()
    expect(names(ranked(shuffled, 'chemists'))).toEqual([
      'Pillar Road Medicals, Hanamkonda',
      'Kazipet Pharmacy',
      'MedPlus Gachibowli',
    ])
  })

  it('gives each member their own providers, and the patient those with no member named', () => {
    expect(names(rankedFor(ob, 'clinics', 'patient'))).toEqual([
      "Dr. S. Rao's clinic, Hanamkonda",
      'Warangal Family Health Centre',
    ])
    expect(names(rankedFor(ob, 'chemists', 'rp'))).toEqual(['MedPlus Gachibowli'])
    expect(names(rankedFor(ob, 'labs', 'patient'))).toEqual(['Hanamkonda Diagnostics', 'Warangal Path Lab'])
    expect(rankedFor(ob, 'labs', 'member_3')).toEqual([])
  })

  it('finds a provider by name loosely, and never one that is not on file', () => {
    expect(findProvider(ob, 'chemists', 'kazipet pharmacy.')?.rank).toBe(2)
    expect(findProvider(ob, 'chemists', 'Apollo Pharmacy')).toBeNull()
  })

  it('carries no courier or payment field on any provider', () => {
    const fields = new Set(
      (['clinics', 'chemists', 'labs'] as const).flatMap((k) => ranked(ob, k).flatMap((p) => Object.keys(p))),
    )
    expect([...fields].sort()).toEqual([
      'distance_km',
      'doctor',
      'for_member',
      'name',
      'phone',
      'pincode',
      'rank',
      'treating_doctor',
    ])
  })

  it('knows the ambulance number', () => {
    expect(emergencyService(ob)).toEqual({ name: 'Ambulance', phone: '108' })
  })
})
