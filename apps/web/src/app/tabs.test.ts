import { describe, expect, it } from 'vitest'
import { TABS, tabsFor } from './tabs.js'

describe('the tabs', () => {
  it('gives every member Home, Chat and Family, and nobody the wallet while its routes are missing', () => {
    for (const role of ['patient', 'responsible_person', 'family'] as const)
      expect(tabsFor(role).map((t) => t.id)).toEqual(['home', 'agent', 'family'])
  })

  it('keeps the wallet for the responsible person once it is available', () => {
    const later = TABS.map((t) => (t.id === 'wallet' ? { ...t, available: true } : t))
    expect(tabsFor('responsible_person', later).map((t) => t.id)).toContain('wallet')
    expect(tabsFor('patient', later).map((t) => t.id)).not.toContain('wallet')
    expect(tabsFor('family', later).map((t) => t.id)).not.toContain('wallet')
  })
})
