import type { Runtime } from './runtime.js'

/**
 * Tables that belong to one run. A reset empties every one of them. Each
 * stage that keeps state in a table of its own names it here.
 */
export const RUN_TABLES: string[] = []

/**
 * Back to a fresh run (reference server/state.js, resetSession).
 *
 * Onboarding is reread from disk, not reused: the agent edits its working
 * copy as it goes (record_update, set_refill_cycle), and reusing it would
 * carry one run's edits into the next. If the file on disk cannot be used,
 * nothing is changed and the reasons are thrown.
 *
 * The event log is not emptied. A new generation starts and the reset is its
 * first event, so a client that connects afterwards replays one event and
 * lands on an empty session.
 */
export function resetSession(
  rt: Runtime,
  reason: string,
): { clock: string; stage: number; generation: number } {
  const fresh = rt.readOnboardingFromDisk()

  rt.db.transaction(() => {
    for (const table of RUN_TABLES) rt.db.prepare(`DELETE FROM ${table}`).run()
    rt.setOnboarding(fresh)
    rt.session.set('clock', fresh.sim_clock.start)
    rt.session.set('stage', 1)
    rt.log.nextGeneration()
  })()
  for (const listener of rt.resetListeners()) listener()

  rt.emit('reset', { reason, clock: fresh.sim_clock.start })
  return { clock: rt.clock().toISOString(), stage: 1, generation: rt.log.generation() }
}
