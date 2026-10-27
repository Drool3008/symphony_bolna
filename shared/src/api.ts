/** Request and response shapes for the HTTP surface. */
import type { Role, ShareLevel } from './onboarding.js'

export interface MemberSummary {
  id: string
  name: string
  role: Role
  language: string
}

export interface MembersResponse {
  members: MemberSummary[]
}

export interface HomeMedicine {
  id: string
  name: string
  strength: string
  purpose: string
  schedule: string
  must_not_miss: boolean
  stock: number
  unit: string
  /** The day the stock was counted. */
  stock_as_of: string
  days_of_cover: number
  runs_out_on: string
}

export interface HomeTest {
  id: string
  name: string
  every_days: number
  last_done: string
  next_due: string
  days_until_due: number
  overdue: boolean
}

/** GET /api/members/:id/home */
export interface MemberHomeResponse {
  member: MemberSummary
  /** The sim clock the figures were computed against. */
  clock: string
  today: string
  /** How much the asking member may see under the subject's consent. Status only leaves the lists empty. */
  shared: ShareLevel
  medicines: HomeMedicine[]
  tests: HomeTest[]
  /** The agent's most recent message to this member, once there is an agent. */
  latest_agent_word: string | null
}

/** POST /api/clock. Moves the sim clock forward. Only a person or one of the agent's own dates moves it. */
export interface ClockRequest {
  /** An ISO timestamp with offset. Omit it and set `to_next_date` to jump to the agent's next date. */
  to?: string
  to_next_date?: boolean
  /** Who or what moved it, in words. Required: every input carries its source. */
  source: string
}

/** A date the agent watches: a medicine running out, or a recurring test falling due. */
export interface AgentDate {
  kind: 'medicine_runs_out' | 'test_due'
  id: string
  member: string
  date: string
}

export interface ClockResponse {
  clock: string
  /** The agent's dates the clock reached on this move. */
  reached: AgentDate[]
}
