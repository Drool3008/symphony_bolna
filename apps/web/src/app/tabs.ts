import type { Role } from '@family-health/shared'
import type { StringKey } from '../i18n/strings.js'

export interface Tab {
  id: 'home' | 'agent' | 'family' | 'wallet'
  path: string
  label: StringKey
  /** Only this role sees the tab. */
  role?: Role
  /** False until the backend serves what the tab shows. */
  available: boolean
}

/**
 * The tabs (brief, Stage W2). The wallet is the responsible person's only,
 * and stays hidden for everyone until the wallet routes exist (HANDOFF.md
 * section 11, planned).
 */
export const TABS: readonly Tab[] = [
  { id: 'home', path: '/home', label: 'tab_home', available: true },
  { id: 'agent', path: '/agent', label: 'tab_agent', available: true },
  { id: 'family', path: '/family', label: 'tab_family', available: true },
  { id: 'wallet', path: '/wallet', label: 'tab_wallet', role: 'responsible_person', available: false },
]

export function tabsFor(role: Role, tabs: readonly Tab[] = TABS): Tab[] {
  return tabs.filter((t) => t.available && (!t.role || t.role === role))
}
