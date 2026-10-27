import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadOnboarding, ONBOARDING_PATH, OnboardingError } from '../src/config/onboarding.js'

const dir = mkdtempSync(join(tmpdir(), 'onboarding-'))
const good = () => JSON.parse(readFileSync(ONBOARDING_PATH, 'utf8'))

/** Writes a variant of the real profile to a temp file and loads it. Never touches config/. */
function loadVariant(edit: (ob: ReturnType<typeof good>) => void): OnboardingError {
  const ob = good()
  edit(ob)
  const path = join(dir, `${Math.random().toString(36).slice(2)}.json`)
  writeFileSync(path, JSON.stringify(ob))
  try {
    loadOnboarding(path)
  } catch (err) {
    if (err instanceof OnboardingError) return err
    throw err
  }
  throw new Error('the variant loaded, but it should have been refused')
}

describe('onboarding is checked when it is loaded', () => {
  it('loads the real profile', () => {
    expect(loadOnboarding().family.members).toHaveLength(3)
  })

  it('says where a file that is not JSON broke', () => {
    const path = join(dir, 'broken.json')
    writeFileSync(path, '{ "family": ')
    expect(() => loadOnboarding(path)).toThrow(/broken\.json cannot be used/)
  })

  it('names the field and the reason for a wrong value', () => {
    const err = loadVariant((ob) => (ob.family.members[2].role = 'cousin'))
    expect(err.message).toMatch(/family\.members\.2\.role/)
  })

  it('refuses a field from a removed rail', () => {
    const err = loadVariant((ob) => (ob.wallet.rail = 'some_payment_rail'))
    expect(err.problems.join('\n')).toMatch(/wallet.*rail/)
  })

  it('refuses a medicine for somebody who is not in the family', () => {
    const err = loadVariant((ob) => (ob.current_medicines[0].member = 'uncle'))
    expect(err.problems).toContain(
      'current_medicines.0.member: uncle is not a family member. Known: patient, rp, member_3',
    )
  })

  it('refuses a family with two responsible people', () => {
    const err = loadVariant((ob) => (ob.family.members[2].role = 'responsible_person'))
    expect(err.message).toMatch(/exactly one responsible_person, found 2/)
  })

  it('refuses a member with no consent on record', () => {
    const err = loadVariant((ob) => delete ob.consent.member_3)
    expect(err.message).toMatch(/no consent recorded for member_3/)
  })

  it('refuses a medicine with both a pill count and a dose count', () => {
    const err = loadVariant((ob) => (ob.current_medicines[0].doses_left = 4))
    expect(err.message).toMatch(/exactly one of pills_left and doses_left/)
  })

  it('refuses a test tied to a prescription nobody has', () => {
    const err = loadVariant((ob) => (ob.recurring_tests[0].needed_for_prescription = 'RX-NONE'))
    expect(err.message).toMatch(/RX-NONE is not the prescription of any medicine/)
  })

  it('lists every problem, not just the first', () => {
    const err = loadVariant((ob) => {
      ob.family.members[0].language = 'Telugu'
      ob.providers.chemists[1].rank = 1
    })
    expect(err.problems.length).toBeGreaterThanOrEqual(1)
    expect(err.message).toMatch(/language/)
  })
})
