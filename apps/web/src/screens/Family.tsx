import type { Strings } from '../i18n/format.js'

/**
 * Waits on the backend's read routes for chats and seeded history
 * (docs/backend-asks.md, ask 1; owner's answer: do not work around it).
 */
export function Family({ s }: { s: Strings }) {
  return <p className="screen-note">{s.t('family_waiting')}</p>
}
