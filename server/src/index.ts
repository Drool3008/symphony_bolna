import { PRODUCT_NAME } from '@family-health/shared'
import { pino } from 'pino'
import { OperatorQueue } from './agent/operator.js'
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
    const rt = createRuntime({ databasePath: fromRoot(env.DATABASE_PATH), loadOnboarding: () => onboarding })
    const operator = new OperatorQueue(rt, env.OPERATOR_AUTO)
    // Calls left waiting by a run that died with the last server have nobody
    // to answer to; the history gets a result for each saying so.
    operator.abandonAll('the server restarted')
    rt.history.closeInterruptedStep()
    const app = createApp(rt, { operator })
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
