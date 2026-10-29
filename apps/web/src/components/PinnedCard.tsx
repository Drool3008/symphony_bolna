import type { ThreadMessage } from '@family-health/shared'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api, ApiError } from '../api/index.js'
import { threadKey, type AgentThread } from '../data/agentThread.js'
import type { Strings } from '../i18n/format.js'
import { CardBody } from './CardBody.js'
import { cardButtons } from './cardLabels.js'

/**
 * A card waiting on this member, pinned at the top of the thread. A tap sends
 * the label as the answer (POST /api/reply with message_id); the server
 * locks it, and the stream locks it on every screen. A second answer is
 * refused by the server, and its reason is shown as it was given.
 */
export function PinnedCard({
  message,
  memberId,
  s,
}: {
  message: ThreadMessage
  memberId: string
  s: Strings
}) {
  const queryClient = useQueryClient()
  const [sending, setSending] = useState<string | null>(null)
  const [refusal, setRefusal] = useState<string | null>(null)
  const onTimeout = message.card?.on_timeout

  async function answer(label: string) {
    setSending(label)
    setRefusal(null)
    try {
      await api.reply({ message_id: message.id, action: label })
      queryClient.setQueryData<AgentThread>(threadKey(memberId), (thread) =>
        thread
          ? {
              ...thread,
              messages: thread.messages.map((m) =>
                m.id === message.id ? { ...m, answer: m.answer ?? label } : m,
              ),
            }
          : thread,
      )
    } catch (err) {
      setRefusal(err instanceof ApiError ? err.reason : s.t('offline'))
    } finally {
      setSending(null)
    }
  }

  return (
    <div className="card card-open">
      <p className="card-band">
        <span aria-hidden="true">● </span>
        {s.t('needs_answer')}
      </p>
      <CardBody message={message} s={s} />
      <div className="card-actions">
        <div className="card-buttons">
          {cardButtons(message.card).map((label, index) => (
            <button
              key={label}
              type="button"
              className={index === 0 ? 'button button-primary' : 'button'}
              disabled={sending !== null}
              onClick={() => void answer(label)}
            >
              {sending === label ? s.t('sending') : label}
            </button>
          ))}
        </div>
        {typeof onTimeout === 'string' && (
          <p className="card-timeout">
            <strong>{s.t('if_no_answer')}:</strong> {onTimeout}
          </p>
        )}
        {refusal && (
          <p className="card-refusal" role="alert">
            {refusal}
          </p>
        )}
      </div>
    </div>
  )
}
