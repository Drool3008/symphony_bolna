import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(import.meta.dirname, '..')

/**
 * The removed vendors' names, built from pieces so this file does not match
 * itself. Only docs/decisions.md may name them (brief, Stage 7).
 */
const NAMES = [
  ['pine', 'labs'],
  ['pine', ' labs'],
  ['delh', 'ivery'],
  ['gna', 'ni'],
  ['vach', 'ana'],
  ['sar', 'vam'],
].map((p) => p.join(''))

describe('the removed vendors', () => {
  it('are named nowhere in the repository but docs/decisions.md', () => {
    const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
      cwd: ROOT,
      encoding: 'utf8',
    })
      .split('\n')
      .filter((f) => f && f !== 'docs/decisions.md')
    const pattern = new RegExp(NAMES.join('|'), 'i')
    const hits = files.filter((f) => {
      try {
        return pattern.test(readFileSync(join(ROOT, f), 'latin1'))
      } catch {
        return false
      }
    })
    expect(hits).toEqual([])
  })
})
