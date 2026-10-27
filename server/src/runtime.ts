import { OnboardingSchema, type AgentEvent, type Onboarding } from '@family-health/shared'
import type { ClockListener } from './clock.js'
import { EventBus } from './events.js'
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
  bus: EventBus
  /** The working copy of onboarding. The agent edits it; a reset rereads the file. */
  onboarding(): Onboarding
  setOnboarding(ob: Onboarding): void
  /** The simulated clock. */
  clock(): Date
  /** Reads onboarding from disk again and checks it. Throws if the file cannot be used. */
  readOnboardingFromDisk(): Onboarding
  /** Runs on a reset, after the store is cleared: anything held in memory lets go here. */
  onReset(listener: () => void): () => void
  resetListeners(): Iterable<() => void>
  /** Runs when the sim clock moves: waits and windows past their deadline close. */
  onClock(listener: ClockListener): () => void
  clockMoved(now: Date, before: Date): void
  /** Logs an event, then sends it to everyone listening. */
  emit(type: string, payload?: Record<string, unknown>): AgentEvent
  /** What is true right now, for a client that has just caught up. */
  syncState(): Record<string, unknown>
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
  const bus = new EventBus()
  const clockListeners = new Set<ClockListener>()
  const resetListeners = new Set<() => void>()

  const rt: Runtime = {
    db,
    session,
    log,
    bus,
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
    readOnboardingFromDisk: loadOnboarding,
    onReset(listener) {
      resetListeners.add(listener)
      return () => resetListeners.delete(listener)
    },
    resetListeners() {
      return resetListeners
    },
    onClock(listener) {
      clockListeners.add(listener)
      return () => clockListeners.delete(listener)
    },
    clockMoved(now, before) {
      for (const listener of clockListeners) listener(now, before)
    },
    emit(type, payload = {}) {
      const event = log.append(type, payload, rt.clock())
      bus.publish(event)
      return event
    },
    syncState() {
      return {
        clock: rt.clock().toISOString(),
        stage: session.get<number>('stage') ?? 1,
        generation: log.generation(),
      }
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
