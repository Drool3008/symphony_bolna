import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const HOOK = join(import.meta.dirname, '..', '.githooks', 'commit-msg')
const dir = mkdtempSync(join(tmpdir(), 'commit-msg-'))

/** Runs the hook on a message; returns null when accepted, the rejection otherwise. */
function check(message: string): string | null {
  const file = join(dir, 'MSG')
  writeFileSync(file, message)
  try {
    // Through bash, as git runs it, since Windows cannot start a script from its first line.
    execFileSync('bash', [HOOK, file], { stdio: 'pipe' })
    return null
  } catch (err) {
    return String((err as { stderr?: Buffer }).stderr ?? err)
  }
}

describe('the commit-msg hook', () => {
  it.each([
    'Start the rebuild with a readme and house rules for the agent',
    'Acting: never stop at silence, never substitute, never half-dispatch',
    'The contact chain walks itself: patient, then the RP, then listing order',
    '# a comment git leaves in\nA fine subject\n\nA body with prose.',
  ])('accepts %j', (message) => {
    expect(check(message)).toBeNull()
  })

  it.each([
    ['feat: x', /conventional-commit prefix/],
    ['fix(api)!: x', /conventional-commit prefix/],
    ['Add the thing', /banned word/],
    ['Updated the readme', /banned word/],
    ['Some misc tidying', /banned word/],
    ['Initial commit', /initial commit/],
    ['A subject that ends with a stop.', /full stop/],
    ['A'.repeat(73), /73 characters/],
    ['Fine subject\n\nCo-Authored-By: Someone <a@b.c>', /Co-Authored-By/],
    ['Fine subject\n\nclaude-session: abc', /Claude-Session/],
    ['Fine subject\n\nGenerated with a tool', /Generated with/],
    ['Fine subject\n\nnoreply@anthropic.com', /noreply@anthropic\.com/],
    ['Fine subject\n\nhttps://claude.ai/code/x', /claude\.ai\/code/],
  ])('rejects %j and says why', (message, why) => {
    expect(check(message)).toMatch(why)
  })
})
