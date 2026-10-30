import type { HomeMedicine, HomeTest, MemberHomeResponse, MemberSummary } from '@family-health/shared'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '../api/index.js'
import { AgentAvatar, AiTag, PersonAvatar } from '../components/brand.js'
import { cardTitle } from '../components/cardLabels.js'
import {
  CalendarPlusIcon,
  ChevronRightIcon,
  FlaskIcon,
  HandIcon,
  PillIcon,
  WarningIcon,
} from '../components/icons.js'
import { isOpenCard, useAgentThread } from '../data/agentThread.js'
import { useHome } from '../data/home.js'
import { useMembers } from '../data/members.js'
import { bookText, coverWidth, isLow, refillText } from '../data/taps.js'
import type { Strings } from '../i18n/format.js'
import './home.css'

/** A tap that says something to the agent, as the member (POST /api/input, `{ text }`). */
type Say = (text: string) => Promise<boolean>

function unitWord(s: Strings, unit: string): string {
  if (unit === 'pills') return s.t('unit_pills')
  if (unit === 'doses') return s.t('unit_doses')
  return unit
}

/**
 * One medicine (the reference's src/PhoneApp.tsx, Home). The whole card is a
 * tap that asks the agent for a refill, then opens Chat. Days of cover and the
 * run-out date are the server's, against the sim clock.
 */
function MedicineCard({
  m,
  owner,
  s,
  today,
  say,
}: {
  m: HomeMedicine
  owner: string
  s: Strings
  today: string
  say: Say
}) {
  const navigate = useNavigate()
  const low = isLow(m)
  const stock = `${s.num(m.stock)} ${unitWord(s, m.unit)}`
  return (
    <li>
      <button
        type="button"
        className="home-card med"
        onClick={() => void say(refillText(m, owner)).then((ok) => ok && navigate('/agent'))}
      >
        <span className="med-top">
          <span className="med-what">
            <span className="med-name">{m.name}</span>
            <span className="med-sub">
              {m.strength} · {m.purpose}
            </span>
          </span>
          <span className={low ? 'chip chip-low' : 'chip chip-ok'}>
            {s.t('days_left', { n: s.num(m.days_of_cover) })}
          </span>
        </span>
        <span className="cover" aria-hidden="true">
          <span
            className={low ? 'cover-fill cover-low' : 'cover-fill cover-ok'}
            style={{ width: coverWidth(m) }}
          />
        </span>
        {m.must_not_miss && (
          <span className="chip chip-must">
            <WarningIcon size={14} />
            {s.t('must_not_miss')}
          </span>
        )}
        <span className="med-meta">
          <span>
            {m.stock_as_of === today
              ? s.t('stock_left', { n: stock })
              : s.t('stock_counted', { n: stock, d: s.date(m.stock_as_of, today) })}
          </span>
          {' · '}
          <span className="med-runs-out">{s.t('runs_out', { d: s.date(m.runs_out_on, today) })}</span>
        </span>
        {low && (
          <span className="med-refill">
            <ChevronRightIcon size={14} />
            {s.t('tap_refill')}
          </span>
        )}
      </button>
    </li>
  )
}

/**
 * A recurring test. Overdue is the server's (a negative days_until_due). Every
 * test has a due date, so every one offers to book it (the reference's
 * src/PhoneApp.tsx: a test that is overdue or due).
 */
function TestCard({ t, s, today, say }: { t: HomeTest; s: Strings; today: string; say: Say }) {
  return (
    <li>
      <button
        type="button"
        className={t.overdue ? 'home-card test test-late' : 'home-card test'}
        onClick={() => void say(bookText(t))}
      >
        <span className="test-top">
          <span className="med-name">{t.name}</span>
          {t.overdue && <WarningIcon size={20} className="test-warning" />}
        </span>
        <span className="med-sub">{s.t('every_n_days', { n: s.num(t.every_days) })}</span>
        <span className="test-dates">
          <span>{s.t('last_done', { d: s.date(t.last_done, today) })}</span>
          {' · '}
          {t.overdue ? (
            <span className="test-overdue">{s.t('overdue', { d: s.date(t.next_due, today) })}</span>
          ) : (
            <span>{s.t('next_due', { d: s.date(t.next_due, today) })}</span>
          )}
        </span>
        <span className="test-book">
          <span className="test-book-label">
            <CalendarPlusIcon size={16} />
            {s.t('book_it')}
          </span>
          <ChevronRightIcon size={16} />
        </span>
      </button>
    </li>
  )
}

/** One member's record, as far as consent lets the asking member see it. */
function Record({
  home,
  s,
  say,
  heading,
  owner,
  showTests,
}: {
  home: MemberHomeResponse
  s: Strings
  say: Say
  heading: string
  /** Another member's record carries their avatar and name in its heading. */
  owner?: string
  showTests: boolean
}) {
  const ownerName = owner ?? home.member.name
  return (
    <>
      <section className="home-section" aria-label={heading}>
        {owner ? (
          <h2 className="owner-title">
            <PersonAvatar name={owner} size={20} />
            {heading}
          </h2>
        ) : (
          <h2 className="section-title">
            <span className="section-icon">
              <PillIcon size={14} />
            </span>
            {heading}
          </h2>
        )}
        {home.medicines.length === 0 ? (
          <p className="home-empty">{s.t('nothing_on_file')}</p>
        ) : (
          <ul className="home-cards">
            {home.medicines.map((m) => (
              <MedicineCard key={m.id} m={m} owner={ownerName} s={s} today={home.today} say={say} />
            ))}
          </ul>
        )}
      </section>
      {showTests && home.tests.length > 0 && (
        <section className="home-section" aria-label={s.t('tests')}>
          <h2 className="section-title">
            <span className="section-icon section-icon-test">
              <FlaskIcon size={14} />
            </span>
            {s.t('tests')}
          </h2>
          <ul className="home-cards">
            {home.tests.map((t) => (
              <TestCard key={t.id} t={t} s={s} today={home.today} say={say} />
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

/** Another member's record, shown only when their consent gives this member the full view. */
function Other({ member, s, say }: { member: MemberSummary; s: Strings; say: Say }) {
  const { data } = useHome(member.id)
  if (!data || data.shared !== 'full' || data.medicines.length === 0) return null
  return (
    <Record
      home={data}
      s={s}
      say={say}
      heading={s.t('whose', { name: member.name })}
      owner={member.name}
      showTests={false}
    />
  )
}

/**
 * The agent's latest word to this member, marked as the agent's. When the
 * server sends null (backend ask 3), the slot draws nothing.
 */
export function LatestWord({ word, s }: { word: string | null; s: Strings }) {
  if (!word) return null
  return (
    <section className="home-card latest" aria-label={s.t('latest')}>
      <div className="latest-head">
        <span className="latest-who">
          <AgentAvatar size={30} />
          <span>{s.t('latest')}</span>
        </span>
        <AiTag />
      </div>
      <p className="latest-word">{word}</p>
    </section>
  )
}

/** Something waits on this member: a card to answer, or a wait the agent has open on them. */
function Waiting({ memberId, s }: { memberId: string; s: Strings }) {
  const thread = useAgentThread(memberId)
  const navigate = useNavigate()
  const card = thread.messages.find(isOpenCard)
  const what =
    thread.waits[0]?.what_for ??
    (card
      ? typeof card.card?.title === 'string'
        ? card.card.title
        : cardTitle(String(card.card?.kind ?? ''))
      : null)
  if (!what) return null
  return (
    <button type="button" className="home-waiting" onClick={() => navigate('/agent')}>
      <span className="home-waiting-icon">
        <HandIcon size={20} />
      </span>
      <span className="home-waiting-text">
        <span className="home-waiting-label">
          {s.t('needs_answer')}
          <ChevronRightIcon size={16} />
        </span>
        <span className="home-waiting-what">{what}</span>
      </span>
    </button>
  )
}

export function Home({ me, s }: { me: MemberSummary; s: Strings }) {
  const { data, error } = useHome(me.id)
  const { data: family } = useMembers()
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const say: Say = async (text) => {
    if (busy) return false
    setBusy(true)
    setProblem(null)
    try {
      await api.input({ text })
      return true
    } catch (err) {
      setProblem(err instanceof ApiError ? err.reason : s.t('offline'))
      return false
    } finally {
      setBusy(false)
    }
  }

  if (error) return <p role="alert">{error instanceof ApiError ? error.reason : s.t('offline')}</p>
  if (!data) return null
  return (
    <div className="home" aria-busy={busy}>
      <Waiting memberId={me.id} s={s} />
      <LatestWord word={data.latest_agent_word} s={s} />
      {problem && (
        <p className="home-problem" role="alert">
          {problem}
        </p>
      )}
      <Record home={data} s={s} say={say} heading={s.t('medicines')} showTests />
      {family?.members
        .filter((m) => m.id !== me.id)
        .map((m) => (
          <Other key={m.id} member={m} s={s} say={say} />
        ))}
    </div>
  )
}
