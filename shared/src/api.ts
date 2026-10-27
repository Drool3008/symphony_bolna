/** Request and response shapes for the HTTP surface. */
import type { Role } from './onboarding.js'

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
  medicines: HomeMedicine[]
  tests: HomeTest[]
  /** The agent's most recent message to this member, once there is an agent. */
  latest_agent_word: string | null
}
