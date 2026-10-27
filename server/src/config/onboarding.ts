import { readFileSync } from 'node:fs'
import { OnboardingSchema, stripComments, type Onboarding } from '@family-health/shared'
import { fromRoot } from './paths.js'

export const ONBOARDING_PATH = fromRoot('config/onboarding.json')

/** A profile that cannot be used, with every reason it cannot, one per line. */
export class OnboardingError extends Error {
  constructor(
    readonly path: string,
    readonly problems: string[],
  ) {
    super(`${path} cannot be used:\n${problems.map((p) => `  - ${p}`).join('\n')}`)
    this.name = 'OnboardingError'
  }
}

/**
 * Reads and checks the onboarding file. Read from disk every time, never
 * cached: the reference reread it on reset so one run's edits never carried
 * into the next (reference server/state.js, resetSession).
 */
export function loadOnboarding(path: string = ONBOARDING_PATH): Onboarding {
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'))
  } catch (err) {
    throw new OnboardingError(path, [(err as Error).message])
  }
  const parsed = OnboardingSchema.safeParse(stripComments(raw))
  if (!parsed.success) {
    throw new OnboardingError(
      path,
      parsed.error.issues.map((i) => `${i.path.length ? i.path.join('.') : '(top level)'}: ${i.message}`),
    )
  }
  return parsed.data
}
