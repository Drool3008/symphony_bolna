import { PRODUCT_NAME, type Role } from '@family-health/shared'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../api/index.js'
import { LogoMark, PersonAvatar } from '../components/brand.js'
import { useMembers } from '../data/members.js'
import { stringsFor } from '../i18n/format.js'
import type { StringKey } from '../i18n/strings.js'
import { useIdentity } from './identity.js'
import './picker.css'

const ROLE: Record<Role, StringKey> = {
  patient: 'role_patient',
  responsible_person: 'role_responsible',
  family: 'role_family',
}

/**
 * Who this phone belongs to. Shown once; after a pick the app is that
 * member's and has no switcher (brief, Section 1: one phone, one person).
 * This is a development identity: it names the member to the server in
 * X-Member-Id and proves nothing (HANDOFF.md section 7). It is reached again
 * only by opening /pick directly. The look is the reference's phone picker
 * (src/main.tsx, 20-phone-picker.png); no member is chosen yet, so it is in
 * English.
 */
export function Picker() {
  const { data, error } = useMembers()
  const { choose } = useIdentity()
  const navigate = useNavigate()
  const s = stringsFor('en-IN')

  return (
    <main className="picker">
      <h1 className="picker-brand">
        <LogoMark size={40} decorative />
        {PRODUCT_NAME}
      </h1>
      <p className="picker-dev">Development identity</p>
      <h2 className="picker-question">{s.t('who_is_using')}</h2>
      <p className="picker-note">
        Picking a name only tells the family server who is asking. It does not sign anyone in.
      </p>
      {error && (
        <p className="picker-problem" role="alert">
          {error instanceof ApiError ? error.reason : s.t('offline')}
        </p>
      )}
      <ul className="picker-list">
        {data?.members.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              className="picker-member"
              aria-labelledby={`pick-${m.id}`}
              aria-describedby={`role-${m.id}`}
              onClick={() => {
                choose(m.id)
                navigate('/', { replace: true })
              }}
            >
              <PersonAvatar name={m.name} size={44} />
              <span className="picker-who">
                <span id={`pick-${m.id}`} className="picker-name">
                  {m.name}
                </span>
                <span id={`role-${m.id}`} className="picker-role">
                  {s.t(ROLE[m.role])}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </main>
  )
}
