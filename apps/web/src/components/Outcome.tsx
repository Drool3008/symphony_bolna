import type { ThreadMessage } from '@family-health/shared'
import type { Strings } from '../i18n/format.js'
import { DecisionMark } from './DecisionMark.js'

/**
 * What became of a card. Only the person a card was sent to may answer it
 * (server/src/app.ts, POST /api/reply), so the answer is theirs; the server
 * does not yet record who answered (backend ask 7). A card nobody answered in
 * time is the agent's to act on by its rules (server/src/domain/waits.ts).
 */
export function Outcome({
  message,
  answeredBy,
  s,
}: {
  message: ThreadMessage
  answeredBy: string
  s: Strings
}) {
  if (message.answer !== null) {
    return (
      <p className="outcome">
        <span className="outcome-what">
          <span aria-hidden="true">✓ </span>
          {message.answer}
        </span>
        <DecisionMark who={{ kind: 'person', name: answeredBy }} s={s} />
        <span className="outcome-when">{s.time(message.answered_at ?? message.at)}</span>
      </p>
    )
  }
  if (message.timed_out_at !== null) {
    return (
      <p className="outcome">
        <span className="outcome-what">
          <span aria-hidden="true">○ </span>
          {s.t('timed_out')}
        </span>
        <DecisionMark who={{ kind: 'agent' }} s={s} />
        <span className="outcome-when">{s.t('agent_goes_on')}</span>
      </p>
    )
  }
  return null
}
