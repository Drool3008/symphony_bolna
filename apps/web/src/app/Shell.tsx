import { PRODUCT_NAME, type MemberSummary } from '@family-health/shared'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { LogoMark, PersonAvatar } from '../components/brand.js'
import { BubbleIcon, HouseIcon, PeopleIcon, SparkIcon, WalletIcon } from '../components/icons.js'
import { markSeen, unreadCount, useAgentThread, waitsOnMember } from '../data/agentThread.js'
import type { Strings } from '../i18n/format.js'
import type { StringKey } from '../i18n/strings.js'
import { useCardArrival, useSession, useStreamStatus } from './live.js'
import { tabsFor, type Tab } from './tabs.js'
import './shell.css'

export interface Screens {
  home: ReactNode
  agent: ReactNode
  family: ReactNode
}

const TAB_ICONS: Record<Tab['id'], typeof HouseIcon> = {
  home: HouseIcon,
  agent: BubbleIcon,
  family: PeopleIcon,
  wallet: WalletIcon,
}

/** The status row's words: working while the agent is in a run, else its stage, else "here". */
export function statusKey(session: { thinking: boolean; stage: number } | undefined): StringKey {
  if (session?.thinking) return 'working'
  if (session && Number.isInteger(session.stage) && session.stage >= 0 && session.stage <= 9)
    return `stage.${session.stage}` as StringKey
  return 'here'
}

/**
 * The brand header (the reference's src/PhoneApp.tsx, Header): the logo and
 * product name, the member's name in a chip that opens nothing (Profile waits
 * on its route), the family's date, and a row saying what the agent is doing.
 */
function Header({ me, s }: { me: MemberSummary; s: Strings }) {
  const session = useSession()
  return (
    <header className="head">
      <div className="head-top">
        <div className="head-brand">
          <span className="head-logo">
            <LogoMark size={30} decorative />
          </span>
          <div>
            <h1 className="head-name">{PRODUCT_NAME}</h1>
            {session && <p className="head-date">{s.longDate(session.clock)}</p>}
          </div>
        </div>
        <p className="head-member">
          <PersonAvatar name={me.name} size={24} />
          <span className="head-member-name">{me.name}</span>
        </p>
      </div>
      <p className="head-status" aria-live="polite">
        <span className={session?.thinking ? 'head-spark head-spark-working' : 'head-spark'}>
          <SparkIcon size={14} />
        </span>
        <span className="head-status-text">{s.t(statusKey(session))}</span>
      </p>
    </header>
  )
}

/**
 * Chat's badge: the agent's messages this member has not seen since they last
 * opened Chat, or, with none unread, a dot when something waits on them (the
 * reference's src/PhoneApp.tsx, Nav).
 */
function useChatBadge(memberId: string, onChat: boolean) {
  const thread = useAgentThread(memberId)
  const [seen, setSeen] = useState<ReadonlySet<string>>(() => new Set())
  useEffect(() => {
    if (onChat) setSeen((before) => markSeen(before, thread.messages))
  }, [onChat, thread.messages])
  return {
    unread: onChat ? 0 : unreadCount(thread.messages, seen),
    nudge: waitsOnMember(thread),
  }
}

/**
 * When a card reaches this member while the app is live, Chat opens on its
 * own: a choice only they can make should not wait in a tab (the reference's
 * src/PhoneApp.tsx, the `lastCard` effect). Cards from the replay of the run
 * so far do not count (src/api/live.ts).
 */
function useOpenChatOnCard(memberId: string) {
  const arrived = useCardArrival(memberId)
  const navigate = useNavigate()
  const atMount = useRef(arrived)
  useEffect(() => {
    if (arrived && arrived !== atMount.current) navigate('/agent')
  }, [arrived, navigate])
}

/** The member's app: the brand header on top, the screen, and the tabs below. */
export function Shell({ me, s, screens }: { me: MemberSummary; s: Strings; screens: Screens }) {
  const status = useStreamStatus()
  const tabs = tabsFor(me.role)
  const onChat = useLocation().pathname === '/agent'
  const badge = useChatBadge(me.id, onChat)
  useOpenChatOnCard(me.id)

  return (
    <div className="shell" lang={me.language}>
      <Header me={me} s={s} />
      {status === 'offline' && (
        <p className="shell-offline" role="status">
          {s.t('offline')}
        </p>
      )}
      <main className="shell-main">
        <Routes>
          {tabs.map((tab) => (
            <Route key={tab.id} path={tab.path} element={screens[tab.id as keyof Screens]} />
          ))}
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </main>
      <nav className="tabs" aria-label={me.name}>
        {tabs.map((tab) => {
          const TabIcon = TAB_ICONS[tab.id]
          return (
            <NavLink key={tab.id} to={tab.path} className="tab">
              <span className="tab-pill">
                <TabIcon size={20} />
                {tab.id === 'agent' && badge.unread > 0 && (
                  <span className="tab-badge">
                    <span aria-hidden="true">{badge.unread}</span>
                    <span className="visually-hidden">{s.t('unread', { n: badge.unread })}</span>
                  </span>
                )}
                {tab.id === 'agent' && badge.unread === 0 && badge.nudge && (
                  <span className="tab-nudge">
                    <span className="visually-hidden">{s.t('needs_answer')}</span>
                  </span>
                )}
              </span>
              <span className="tab-label">{s.t(tab.label)}</span>
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}
