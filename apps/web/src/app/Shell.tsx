import type { MemberSummary } from '@family-health/shared'
import type { ReactNode } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import type { Strings } from '../i18n/format.js'
import { useSession, useStreamStatus } from './live.js'
import { tabsFor } from './tabs.js'
import './shell.css'

export interface Screens {
  home: ReactNode
  agent: ReactNode
  family: ReactNode
}

/** The member's app: their name and the family's date on top, the tabs below. */
export function Shell({ me, s, screens }: { me: MemberSummary; s: Strings; screens: Screens }) {
  const session = useSession()
  const status = useStreamStatus()
  const tabs = tabsFor(me.role)
  return (
    <div className="shell" lang={me.language}>
      <header className="shell-head">
        <h1 className="shell-name">{me.name}</h1>
        {session && <p className="shell-date">{s.longDate(session.clock)}</p>}
      </header>
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
      <nav className="shell-tabs" aria-label={me.name}>
        {tabs.map((tab) => (
          <NavLink key={tab.id} to={tab.path} className="shell-tab">
            {s.t(tab.label)}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
