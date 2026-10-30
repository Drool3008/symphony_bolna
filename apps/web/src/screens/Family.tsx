import { PeopleIcon } from '../components/icons.js'
import type { Strings } from '../i18n/format.js'
import './family.css'

/**
 * Waits on the backend's read routes for chats and seeded history
 * (docs/backend-asks.md, ask 1; owner's answer: do not work around it). Until
 * then, a quiet note in the reference's look.
 */
export function Family({ s }: { s: Strings }) {
  return (
    <div className="family">
      <div className="family-note">
        <span className="family-icon">
          <PeopleIcon size={24} />
        </span>
        <p>{s.t('family_waiting')}</p>
      </div>
    </div>
  )
}
