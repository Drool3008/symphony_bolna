import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { fromRoot, ROOT } from '../src/config/paths.js'

describe('paths from the repository root', () => {
  it('resolve a relative path under the root', () => {
    expect(fromRoot('config/onboarding.json')).toBe(join(ROOT, 'config', 'onboarding.json'))
    expect(existsSync(fromRoot('config/onboarding.json'))).toBe(true)
  })

  it('keep an absolute path as given, such as a database in the temp folder', () => {
    const file = join(tmpdir(), 'session.sqlite')
    expect(fromRoot(file)).toBe(file)
  })
})
