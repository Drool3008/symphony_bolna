import { PRODUCT_NAME, type MemberSummary, type ThreadMessage } from '@family-health/shared'
import { useEffect, useRef } from 'react'
import { useSession } from '../app/live.js'
import { AgentAvatar, PersonAvatar } from '../components/brand.js'
import { Composer } from '../components/Composer.js'
import { DecisionCard } from '../components/DecisionCard.js'
import { ArrowDownIcon, HandIcon } from '../components/icons.js'
import { useAgentThread } from '../data/agentThread.js'
import type { Strings } from '../i18n/format.js'
import './agent.css'

/**
 * One line in the thread (the reference's src/components/AgentChat.tsx): the
 * agent on the left with its avatar and "name · AI" on the first of a run, the
 * member on the right in the familiar green with their own avatar.
 */
function Bubble({
  m,
  first,
  me,
  s,
  anchor,
}: {
  m: ThreadMessage
  first: boolean
  me: MemberSummary
  s: Strings
  anchor: (el: HTMLLIElement | null) => void
}) {
  const agent = m.from === 'agent'
  const who = `${PRODUCT_NAME} · AI`
  return (
    <li ref={anchor} className={`row ${agent ? 'row-agent' : 'row-mine'}${first ? ' row-first' : ''}`}>
      {agent && (first ? <AgentAvatar size={28} /> : <span className="row-gap" />)}
      <div className={agent ? 'bubble bubble-agent' : 'bubble bubble-mine'}>
        {agent && first ? (
          <p className="bubble-who">{who}</p>
        ) : (
          <span className="visually-hidden">{agent ? who : s.t('you')}: </span>
        )}
        {m.text && (
          <p className="bubble-text" lang={m.language ?? undefined}>
            {m.text}
          </p>
        )}
        {m.card && <DecisionCard message={m} memberId={me.id} s={s} />}
        <p className="bubble-time">{s.time(m.at)}</p>
      </div>
      {!agent && (first ? <PersonAvatar name={me.name} size={28} /> : <span className="row-gap" />)}
    </li>
  )
}

/** The member's one conversation with the agent (brief, Section 1). */
export function Agent({ me, s }: { me: MemberSummary; s: Strings }) {
  const thread = useAgentThread(me.id)
  const thinking = useSession()?.thinking ?? false
  const box = useRef<HTMLDivElement>(null)
  const anchors = useRef(new Map<string, HTMLLIElement>())
  const wait = thread.waits[0]
  const firstOpen = thread.openCards[0]

  // Keep the newest line in view, as a messaging app does.
  useEffect(() => {
    if (box.current) box.current.scrollTop = box.current.scrollHeight
  }, [thread.messages.length, thinking])

  return (
    <div className="agent">
      {thread.decisionsWaiting > 0 && firstOpen && (
        <button
          type="button"
          className="decisions-bar"
          onClick={() =>
            anchors.current.get(firstOpen.id)?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
          }
        >
          <HandIcon size={16} />
          <span>
            {s.t(thread.decisionsWaiting === 1 ? 'decisions_one' : 'decisions_many', {
              n: thread.decisionsWaiting,
            })}
          </span>
          <ArrowDownIcon size={16} className="decisions-bar-arrow" />
        </button>
      )}
      <div className="thread" ref={box}>
        {thread.messages.length === 0 && !thinking ? (
          <p className="thread-empty">{s.t('no_messages')}</p>
        ) : (
          <ol className="rows">
            {thread.messages.map((m, i) => (
              <Bubble
                key={m.id}
                m={m}
                first={thread.messages[i - 1]?.from !== m.from}
                me={me}
                s={s}
                anchor={(el) => {
                  if (el) anchors.current.set(m.id, el)
                  else anchors.current.delete(m.id)
                }}
              />
            ))}
          </ol>
        )}
        {thinking && (
          <div className="row row-agent row-first">
            <AgentAvatar size={28} />
            <p className="typing" role="status" aria-label={s.t('working')}>
              <span />
              <span />
              <span />
            </p>
          </div>
        )}
      </div>
      {wait && (
        <p className="wait-strip">
          <HandIcon size={16} />
          <span className="wait-strip-text">
            {s.t('waiting_on_you')} {wait.what_for}
          </span>
        </p>
      )}
      <Composer s={s} />
    </div>
  )
}
