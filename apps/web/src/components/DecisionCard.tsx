import type { ThreadMessage } from '@family-health/shared'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api, ApiError } from '../api/index.js'
import { threadKey, type AgentThread } from '../data/agentThread.js'
import type { Strings } from '../i18n/format.js'
import type { StringKey } from '../i18n/strings.js'
import { AiTag, HumanTag } from './brand.js'
import { cardButtons, cardTitle, cardTone, isYes, pastTense, type CardTone } from './cardLabels.js'
import { CheckCircleIcon, CheckIcon, ClockIcon, HandIcon, PauseIcon } from './icons.js'

/**
 * The facts a person checks before saying yes, in the order they would check
 * them (the reference's AgentChat.tsx, FACTS). The fields are the card's own,
 * as the agent wrote them (server/src/agent/tools.ts, send_message); only
 * those that are there are shown.
 */
const FACTS: [string, StringKey][] = [
  ['medicine', 'fact_medicine'],
  ['strength', 'fact_strength'],
  ['quantity', 'fact_quantity'],
  ['test', 'fact_test'],
  ['doctor', 'fact_doctor'],
  ['clinic', 'fact_clinic'],
  ['when', 'fact_when'],
  ['for', 'fact_for'],
  ['payee', 'fact_payee'],
]

interface Item {
  label: string
  amount_inr?: number
}

interface Option {
  label: string
  value: string
}

const isItem = (x: unknown): x is Item =>
  typeof x === 'object' && x !== null && typeof (x as Item).label === 'string'
const isOption = (x: unknown): x is Option =>
  typeof x === 'object' && x !== null && typeof (x as Option).label === 'string'

function Band({ tone, answer, s }: { tone: CardTone; answer: string | null; s: Strings }) {
  if (tone === 'record')
    return (
      <div className="dc-band">
        <span className="dc-band-label">
          <CheckCircleIcon size={16} />
          {s.t('card_done')}
        </span>
        <AiTag />
      </div>
    )
  if (tone === 'open')
    return (
      <div className="dc-band">
        <span className="dc-band-label">
          <HandIcon size={16} />
          {s.t('your_decision')}
        </span>
        <HumanTag label={s.t('human')} />
      </div>
    )
  // Nobody answered: the agent goes on by its rules, so the tag is the agent's (proposal).
  if (tone === 'timed_out')
    return (
      <div className="dc-band">
        <span className="dc-band-label">
          <ClockIcon size={16} />
          {s.t('no_answer')}
        </span>
        <AiTag />
      </div>
    )
  return (
    <div className="dc-band">
      <span className="dc-band-label">
        {tone === 'yes' ? <CheckCircleIcon size={16} /> : <PauseIcon size={16} />}
        {pastTense(answer ?? '')}
      </span>
      <HumanTag label={s.t('human')} />
    </div>
  )
}

/**
 * A card from the agent, inline in the thread (the reference's
 * src/components/AgentChat.tsx, DecisionCard): amber while it waits on the
 * member, green once they said yes, grey for a hold, a no or no answer, and
 * violet for a record of something already done, which never has buttons.
 *
 * A tap sends the label as the answer (POST /api/reply with message_id); the
 * server locks the card and the stream locks it on every screen. A second
 * answer is refused by the server, and its reason is shown as given.
 */
export function DecisionCard({
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
  const c = message.card ?? {}
  const tone = cardTone(message)

  const text = (key: string) =>
    (typeof c[key] === 'string' && c[key] !== '') || typeof c[key] === 'number' ? String(c[key]) : null
  const rupees = (n: unknown) => (typeof n === 'number' ? `₹${s.num(n)}` : null)
  const facts = FACTS.map(([key, label]) => [label, text(key)] as const).filter(
    (row): row is readonly [StringKey, string] => row[1] !== null,
  )
  const items = Array.isArray(c.items) ? c.items.filter(isItem) : []
  const options = Array.isArray(c.options) ? c.options.filter(isOption) : []
  const total = rupees(c.total_inr)
  const receiptNo = text('receipt_no')
  const onTimeout = text('on_timeout')

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
    <div className={`dc dc-${tone}`}>
      <Band tone={tone} answer={message.answer} s={s} />
      <div className="dc-body">
        <p className="dc-title">{text('title') ?? cardTitle(String(c.kind ?? ''))}</p>
        {rupees(c.amount_inr) && <p className="dc-amount">{rupees(c.amount_inr)}</p>}
        {facts.length > 0 && (
          <dl className="dc-facts">
            {facts.map(([label, value]) => (
              <div key={label} className="dc-fact">
                <dt>{s.t(label)}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        )}
        {text('detail') && <p className="dc-detail">{text('detail')}</p>}
        {(items.length > 0 || total || receiptNo) && (
          <div className="dc-receipt">
            {receiptNo && <p className="dc-receipt-no">{s.t('receipt', { n: receiptNo })}</p>}
            {items.map((item, i) => (
              <p key={i} className="dc-line">
                <span>{item.label}</span>
                {typeof item.amount_inr === 'number' && (
                  <span className="dc-figure">{rupees(item.amount_inr)}</span>
                )}
              </p>
            ))}
            {total && (
              <p className="dc-line dc-total">
                <span>{s.t('total')}</span>
                <span className="dc-figure">{total}</span>
              </p>
            )}
          </div>
        )}
        {rupees(c.wallet_left_inr) && (
          <p className="dc-wallet">
            {s.t('wallet_after')} <b>{rupees(c.wallet_left_inr)}</b>
          </p>
        )}
        {options.length > 0 && (
          <div className="dc-options">
            {options.map((o, i) => (
              <div key={i} className="dc-option">
                <p className="dc-option-label">{o.label}</p>
                <p className="dc-option-value">{String(o.value)}</p>
              </div>
            ))}
          </div>
        )}
        {text('why') && (
          <p className="dc-why">
            <b>{s.t('why')}</b> <span>{text('why')}</span>
          </p>
        )}

        {(tone === 'yes' || tone === 'other') && (
          <p className="dc-outcome">
            {message.answered_at
              ? s.t('you_chose_at', { answer: message.answer ?? '', time: s.time(message.answered_at) })
              : s.t('you_chose', { answer: message.answer ?? '' })}
          </p>
        )}
        {tone === 'timed_out' && (
          <p className="dc-outcome">{s.t('no_answer_then', { then: onTimeout ?? s.t('agent_goes_on') })}</p>
        )}
        {tone === 'open' && (
          <>
            {cardButtons(message.card).length > 0 && (
              <div className="dc-buttons">
                {cardButtons(message.card).map((label, index) => (
                  <button
                    key={label}
                    type="button"
                    className={index === 0 ? 'dc-button dc-button-first' : 'dc-button'}
                    disabled={sending !== null}
                    onClick={() => void answer(label)}
                  >
                    {index === 0 && isYes(label) && <CheckIcon size={20} />}
                    {sending === label ? s.t('sending') : label}
                  </button>
                ))}
              </div>
            )}
            {onTimeout && (
              <p className="dc-timeout">
                <b>{s.t('if_no_answer')}:</b> {onTimeout}
              </p>
            )}
            {refusal && (
              <p className="dc-refusal" role="alert">
                {refusal}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
