import { createApp } from '../src/app.js'
import { OperatorQueue } from '../src/agent/operator.js'
import { loadOnboarding } from '../src/config/onboarding.js'
import { createRuntime, type Runtime } from '../src/runtime.js'

/** A fresh runtime on an in-memory store, seeded from config/onboarding.json. */
export function testRuntime(): Runtime {
  return createRuntime({ databasePath: ':memory:', loadOnboarding: () => loadOnboarding() })
}

/** A runtime and the app over it, with its operator queue. */
export function testApp(rt: Runtime = testRuntime(), auto = false) {
  const operator = new OperatorQueue(rt, auto)
  return { rt, operator, app: createApp(rt, { operator }) }
}
