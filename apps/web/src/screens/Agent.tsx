import type { MemberSummary, ThreadMessage } from '@family-health/shared'
import { CardBody } from '../components/CardBody.js'
import { Composer } from '../components/Composer.js'
import { Outcome } from '../components/Outcome.js'
import { PinnedCard } from '../components/PinnedCard.js'
import { isOpenCard, useAgentThread } from '../data/agentThread.js'
import type { Strings } from '../i18n/format.js'
import './agent.css'

function Line({ m, me, s }: { m: ThreadMessage; me: MemberSummary; s: Strings }) {
  if (m.from === 'agent') {
    return (
      <li className="line line-agent">
        <p className="line-who">
          <span aria-hidden="true">◆ </span>
          {s.t('agent')} · {s.time(m.at)}
        </p>
        <p className="line-text" lang={m.language ?? undefined}>
          {m.text}
        </p>
        {m.card && isOpenCard(m) && (
          <p className="line-pointer">
            <span aria-hidden="true">↑ </span>
            {s.t('needs_answer')}
          </p>
        )}
        {m.card && !isOpenCard(m) && (
          <div className="card card-in-line">
            <CardBody message={m} s={s} />
            <Outcome message={m} answeredBy={me.name} s={s} />
          </div>
        )}
      </li>
    )
  }
  return (
    <li className="line line-person">
      <p className="line-who">
        {m.from === me.id ? s.t('you') : m.from} · {s.time(m.at)}
      </p>
      <p className="line-text">{m.text}</p>
    </li>
  )
}

/** The member's one conversation with the agent (brief, Section 1). */
export function Agent({ me, s }: { me: MemberSummary; s: Strings }) {
  const thread = useAgentThread(me.id)
  return (
    <div className="agent">
      {thread.pinnedCards.length + thread.pinnedWaits.length > 0 && (
        <section className="pinned" aria-label={s.t('needs_answer')}>
          {thread.pinnedCards.map((m) => (
            <PinnedCard key={m.id} message={m} memberId={me.id} s={s} />
          ))}
          {thread.pinnedWaits.map((w) => (
            <p key={w.id} className="wait">
              <span aria-hidden="true">● </span>
              {s.t('needs_answer')}
            </p>
          ))}
        </section>
      )}
      {thread.messages.length === 0 ? (
        <p className="screen-note">{s.t('no_messages')}</p>
      ) : (
        <ol className="lines">
          {thread.messages.map((m) => (
            <Line key={m.id} m={m} me={me} s={s} />
          ))}
        </ol>
      )}
      <Composer s={s} />
    </div>
  )
}
