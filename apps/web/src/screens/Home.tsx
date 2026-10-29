import type { HomeMedicine, MemberHomeResponse, MemberSummary } from '@family-health/shared'
import { ApiError } from '../api/index.js'
import { useHome } from '../data/home.js'
import { useMembers } from '../data/members.js'
import type { Strings } from '../i18n/format.js'
import './home.css'

function unitWord(s: Strings, unit: string): string {
  if (unit === 'pills') return s.t('unit_pills')
  if (unit === 'doses') return s.t('unit_doses')
  return unit
}

function MedicineRow({ m, s, today }: { m: HomeMedicine; s: Strings; today: string }) {
  return (
    <li className="row">
      <div className="row-main">
        <p className="row-title">
          {m.name} <span className="row-sub">{m.strength}</span>
        </p>
        <p className="row-meta">{m.purpose}</p>
        <p className="row-meta">{s.t('stock_left', { n: `${s.num(m.stock)} ${unitWord(s, m.unit)}` })}</p>
        {m.must_not_miss && (
          <p className="row-flag">
            <span aria-hidden="true">■ </span>
            {s.t('must_not_miss')}
          </p>
        )}
      </div>
      <div className="row-figure">
        <p className="figure">{s.num(m.days_of_cover)}</p>
        <p className="figure-label">{s.t('days_left_label')}</p>
        <p className="row-meta">{s.t('runs_out', { d: s.date(m.runs_out_on, today) })}</p>
      </div>
    </li>
  )
}

/** One member's record, as far as consent lets the asking member see it. */
function Record({ home, s, heading }: { home: MemberHomeResponse; s: Strings; heading: string }) {
  return (
    <section aria-label={heading}>
      <h2 className="section-label">{heading}</h2>
      {home.medicines.length === 0 ? (
        <p className="row-meta">{s.t('nothing_on_file')}</p>
      ) : (
        <ul className="rows">
          {home.medicines.map((m) => (
            <MedicineRow key={m.id} m={m} s={s} today={home.today} />
          ))}
        </ul>
      )}
    </section>
  )
}

/** Another member's record, shown only when their consent gives this member the full view. */
function Other({ member, s }: { member: MemberSummary; s: Strings }) {
  const { data } = useHome(member.id)
  if (!data || data.shared !== 'full' || data.medicines.length === 0) return null
  return <Record home={data} s={s} heading={s.t('whose', { name: member.name })} />
}

export function Home({ me, s }: { me: MemberSummary; s: Strings }) {
  const { data, error } = useHome(me.id)
  const { data: family } = useMembers()
  if (error) return <p role="alert">{error instanceof ApiError ? error.reason : s.t('offline')}</p>
  if (!data) return null
  return (
    <div className="home">
      <Record home={data} s={s} heading={s.t('medicines')} />
      {family?.members
        .filter((m) => m.id !== me.id)
        .map((m) => (
          <Other key={m.id} member={m} s={s} />
        ))}
    </div>
  )
}
