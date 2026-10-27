import { PRODUCT_NAME } from '@family-health/shared'
import { pino } from 'pino'
import { createApp } from './app.js'
import { parseEnv } from './config/env.js'
import { loadOnboarding, OnboardingError } from './config/onboarding.js'

const log = pino({ name: PRODUCT_NAME })

/**
 * Boot. A bad profile stops the server here, before anything listens, with
 * every reason printed, rather than surfacing as a strange answer mid-run.
 */
function boot() {
  try {
    const env = parseEnv()
    const onboarding = loadOnboarding()
    const start = new Date(onboarding.sim_clock.start)
    const app = createApp({ onboarding, clock: () => start })
    app.listen(env.PORT, () => {
      log.info({ port: env.PORT, model: env.MODEL_PROVIDER, speech: env.SPEECH_PROVIDER }, 'listening')
    })
  } catch (err) {
    if (err instanceof OnboardingError) console.error(err.message)
    else console.error((err as Error).message)
    process.exit(1)
  }
}

boot()
