import { OnboardingSchema, type AgentEvent, type Onboarding } from '@family-health/shared'
import { loadFamilyHistory } from './domain/history.js'
import { EventBus } from './events.js'
import { Hook, SyncParts } from './hooks.js'
import { AgentThreads, FamilyChats } from './store/conversations.js'
import { openDb, type Db } from './store/db.js'
import { EventLog } from './store/event-log.js'
import { ModelHistory } from './store/history.js'
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
  /** The agent's conversation with each person, the group and the doctor. */
  threads: AgentThreads
  /** What the family says to each other. Never read by the model. */
  chats: FamilyChats
  /** What the model has been given and has said. */
  history: ModelHistory
  hooks: {
    /** The sim clock moved: waits and windows past their deadline close. */
    clock: Hook<[now: Date, before: Date]>
    /** A reset cleared the store: anything held in memory lets go. */
    reset: Hook
    /** A real input reached the model's history: the agent has something to read. */
    input: Hook
    /** Pieces of the sync event a late client gets. */
    sync: SyncParts
  }
  /** The working copy of onboarding. The agent edits it; a reset rereads the file. */
  onboarding(): Onboarding
  setOnboarding(ob: Onboarding): void
  /** Reads onboarding from disk again and checks it. Throws if the file cannot be used. */
  readOnboardingFromDisk(): Onboarding
  /** The simulated clock. */
  clock(): Date
  /** Logs an event, then sends it to everyone listening. */
  emit(type: string, payload?: Record<string, unknown>): AgentEvent
  /** What is true right now, for a client that has just caught up. */
  syncState(): Record<string, unknown>
}

export interface RuntimeOptions {
  databasePath: string
  /** Reads onboarding from disk. Called when the store holds none yet, and on a reset. */
  loadOnboarding: () => Onboarding
}

export function createRuntime({ databasePath, loadOnboarding }: RuntimeOptions): Runtime {
  const db = openDb(databasePath)
  const session = new SessionValues(db)
  const log = new EventLog(db, session)
  const bus = new EventBus()
  const groupIds = new Set(
    loadFamilyHistory()
      .chats.filter((c) => c.kind === 'group')
      .map((c) => c.id),
  )

  // The stores need the runtime and the runtime hands out the stores, so they
  // are made just after it and read through getters.
  let threads: AgentThreads
  let chats: FamilyChats
  let history: ModelHistory

  const rt: Runtime = {
    db,
    session,
    log,
    bus,
    get threads() {
      return threads
    },
    get chats() {
      return chats
    },
    get history() {
      return history
    },
    hooks: { clock: new Hook<[Date, Date]>(), reset: new Hook(), input: new Hook(), sync: new SyncParts() },
    onboarding() {
      // Checked on the way out as well as in, so a store written by an older
      // build cannot hand the agent a shape it does not expect.
      return OnboardingSchema.parse(session.get<unknown>('onboarding'))
    },
    setOnboarding(ob) {
      session.set('onboarding', ob)
    },
    readOnboardingFromDisk: loadOnboarding,
    clock() {
      return new Date(session.get<string>('clock') ?? rt.onboarding().sim_clock.start)
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
        ...rt.hooks.sync.read(),
      }
    },
  }
  threads = new AgentThreads(rt)
  chats = new FamilyChats(rt, groupIds)
  history = new ModelHistory(rt)

  if (session.get('onboarding') === undefined) {
    const ob = loadOnboarding()
    rt.setOnboarding(ob)
    session.set('clock', ob.sim_clock.start)
    session.set('stage', 1)
    session.set('generation', 1)
  }
  return rt
}
