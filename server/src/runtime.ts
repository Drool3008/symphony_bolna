import { OnboardingSchema, type AgentEvent, type Onboarding } from '@family-health/shared'
import { openDb, type Db } from './store/db.js'
import { EventLog } from './store/event-log.js'
import { SessionValues } from './store/session.js'

/**
 * Everything a request or the agent needs, in one object: the store, the
 * session's values and the event log. Passed in, never imported as a global,
 * so a test gets a fresh one on an in-memory store.
 */
export interface Runtime {
  db: Db
  session: SessionValues
  log: EventLog
  /** The working copy of onboarding. The agent edits it; a reset rereads the file. */
  onboarding(): Onboarding
  setOnboarding(ob: Onboarding): void
  /** The simulated clock. */
  clock(): Date
  emit(type: string, payload?: Record<string, unknown>): AgentEvent
}

export interface RuntimeOptions {
  databasePath: string
  /** Reads onboarding from disk. Called when the store holds none yet. */
  loadOnboarding: () => Onboarding
}

export function createRuntime({ databasePath, loadOnboarding }: RuntimeOptions): Runtime {
  const db = openDb(databasePath)
  const session = new SessionValues(db)
  const log = new EventLog(db, session)

  const rt: Runtime = {
    db,
    session,
    log,
    onboarding() {
      const stored = session.get<unknown>('onboarding')
      // Checked on the way out as well as in, so a store written by an older
      // build cannot hand the agent a shape it does not expect.
      return OnboardingSchema.parse(stored)
    },
    setOnboarding(ob) {
      session.set('onboarding', ob)
    },
    clock() {
      return new Date(session.get<string>('clock') ?? rt.onboarding().sim_clock.start)
    },
    emit(type, payload = {}) {
      return log.append(type, payload, rt.clock())
    },
  }

  if (session.get('onboarding') === undefined) {
    const ob = loadOnboarding()
    rt.setOnboarding(ob)
    session.set('clock', ob.sim_clock.start)
    session.set('stage', 1)
    session.set('generation', 1)
  }
  return rt
}
