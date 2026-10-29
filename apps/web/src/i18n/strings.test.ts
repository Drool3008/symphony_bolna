import { describe, expect, it } from 'vitest'
import { stringsFor } from './format.js'
import { dictionaries } from './strings.js'

describe('the strings', () => {
  it('has every English key in Telugu too, and none left empty', () => {
    expect(Object.keys(dictionaries.te).sort()).toEqual(Object.keys(dictionaries.en).sort())
    for (const value of Object.values(dictionaries.te)) expect(value.trim()).not.toBe('')
  })

  it('picks the dictionary from the onboarding language', () => {
    expect(stringsFor('te-IN').t('medicines')).toBe('మందులు')
    expect(stringsFor('en-IN').t('medicines')).toBe('Medicines')
  })

  it('fills in values', () => {
    expect(stringsFor('en-IN').t('runs_out', { d: '9 Oct' })).toBe('runs out 9 Oct')
    expect(stringsFor('en-IN').t('answered_by', { name: 'Arun' })).toBe('Answered by Arun')
  })

  it('shows the year only when it is not the year on the family clock', () => {
    const s = stringsFor('en-IN')
    expect(s.date('2026-10-09', '2026-10-06')).toBe('9 Oct')
    expect(s.date('2027-07-18', '2026-10-06')).toBe('18 Jul 2027')
  })

  it("tells the time on the family's clock, not the browser's", () => {
    // 18:30 UTC is midnight in India.
    expect(stringsFor('en-IN').time('2026-10-08T18:30:00.000Z')).toMatch(/^12:00\s?am$/i)
    expect(stringsFor('en-IN').longDate('2026-10-08T18:30:00.000Z')).toBe('Friday, 9 October')
  })
})
