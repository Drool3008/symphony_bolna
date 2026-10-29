import type { ThreadMessage } from '@family-health/shared'
import type { Strings } from '../i18n/format.js'
import { cardTitle } from './cardLabels.js'

/**
 * A card's fields as the agent wrote them (server/src/agent/tools.ts,
 * send_message). Only fields that are there are shown; amounts reach only the
 * thread of the person the card was sent to, which the server decides.
 */
export function CardBody({ message, s }: { message: ThreadMessage; s: Strings }) {
  const c = message.card ?? {}
  const text = (key: string) => (typeof c[key] === 'string' && c[key] !== '' ? (c[key] as string) : null)
  const rupees = (key: string) => (typeof c[key] === 'number' ? `₹${s.num(c[key] as number)}` : null)
  const what = [text('medicine'), text('strength'), text('quantity'), text('test')]
    .filter(Boolean)
    .join(' · ')
  const rows: [string, string | null][] = [
    [s.t('card_amount'), rupees('amount_inr')],
    [s.t('card_to'), text('payee') ?? text('clinic') ?? text('doctor')],
    [s.t('card_for'), text('for')],
    [s.t('card_what'), what || null],
    [s.t('card_wallet_after'), rupees('wallet_left_inr')],
  ]
  return (
    <div className="card-body">
      <p className="card-title">{text('title') ?? cardTitle(String(c.kind ?? ''))}</p>
      {text('detail') && <p className="card-detail">{text('detail')}</p>}
      <dl className="card-fields">
        {rows
          .filter((row): row is [string, string] => row[1] !== null)
          .map(([label, value]) => (
            <div key={label} className="card-field">
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
      </dl>
      {text('why') && <p className="card-why">{text('why')}</p>}
    </div>
  )
}
