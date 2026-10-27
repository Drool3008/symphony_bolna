import { PRODUCT_NAME } from '@family-health/shared'
import { pino } from 'pino'
import { OperatorQueue } from './agent/operator.js'
import { startAgent } from './agent/start.js'
import { createApp } from './app.js'
import { parseEnv } from './config/env.js'
import { loadOnboarding, OnboardingError } from './config/onboarding.js'
import { fromRoot } from './config/paths.js'
import { createRuntime } from './runtime.js'

const log = pino({ name: PRODUCT_NAME })

/**
 * Boot. A bad profile stops the server here, before anything listens, with
 * every reason printed, rather than surfacing as a strange answer mid-run.
 */
function boot() {
  try {
    const env = parseEnv()
    // Always read and checked, even when the store already holds a working
    // copy: a broken file on disk would otherwise go unnoticed until a reset.
    const onboarding = loadOnboarding()
    const databasePath = fromRoot(env.DATABASE_PATH)
    const rt = createRuntime({ databasePath, loadOnboarding: () => onboarding })
    const operator = new OperatorQueue(rt, env.OPERATOR_AUTO)
    // Calls left waiting by a run that died with the last server have nobody
    // to answer to; the history gets a result for each saying so.
    operator.abandonAll('the server restarted')
    rt.waits.releaseAll('server_restarted')
    const interrupted = rt.history.closeInterruptedStep()
    const { agent, selectScenario } = startAgent(rt, env, operator, { databasePath })
    const app = createApp(rt, { operator, ...(selectScenario ? { selectScenario } : {}) })
    // A step cut off by the restart now has its results, and the model reads
    // them; otherwise, an input that arrived and was never answered is answered now.
    if (interrupted) agent.resume()
    else agent.wake()
    app.listen(env.PORT, () => {
      log.info(
        {
          port: env.PORT,
          model: env.MODEL_PROVIDER,
          speech: env.SPEECH_PROVIDER,
          database: env.DATABASE_PATH,
        },
        'listening',
      )
    })
  } catch (err) {
    if (err instanceof OnboardingError) console.error(err.message)
    else console.error((err as Error).message)
    process.exit(1)
  }
}

boot()
