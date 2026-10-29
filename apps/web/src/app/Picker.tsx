import { useNavigate } from 'react-router-dom'
import { ApiError } from '../api/index.js'
import { useMembers } from '../data/members.js'
import { useIdentity } from './identity.js'
import './picker.css'

/**
 * Who this phone belongs to. Shown once; after a pick the app is that
 * member's and has no switcher (brief, Section 1: one phone, one person).
 * This is a development identity: it names the member to the server in
 * X-Member-Id and proves nothing (HANDOFF.md section 7). It is reached again
 * only by opening /pick directly.
 */
export function Picker() {
  const { data, error } = useMembers()
  const { choose } = useIdentity()
  const navigate = useNavigate()

  return (
    <main className="picker">
      <p className="picker-dev">Development identity</p>
      <h1>Who is this phone for?</h1>
      <p className="picker-note">
        Picking a name only tells the family server who is asking. It does not sign anyone in.
      </p>
      {error && (
        <p role="alert">
          {error instanceof ApiError ? error.reason : 'The app cannot reach the family server right now.'}
        </p>
      )}
      <ul className="picker-list">
        {data?.members.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              lang={m.language}
              onClick={() => {
                choose(m.id)
                navigate('/', { replace: true })
              }}
            >
              {m.name}
            </button>
          </li>
        ))}
      </ul>
    </main>
  )
}
