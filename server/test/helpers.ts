import { loadOnboarding } from '../src/config/onboarding.js'
import { createRuntime, type Runtime } from '../src/runtime.js'

/** A fresh runtime on an in-memory store, seeded from config/onboarding.json. */
export function testRuntime(): Runtime {
  return createRuntime({ databasePath: ':memory:', loadOnboarding: () => loadOnboarding() })
}
