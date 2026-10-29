import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'

const here = import.meta.dirname
const css = readFileSync(join(here, 'tokens.css'), 'utf8')
const doc = readFileSync(join(here, '../../docs/design-tokens.md'), 'utf8')

/** The token names in the first column of each table in docs/design-tokens.md. */
const documented = [...doc.matchAll(/^\| `([a-z0-9-]+)` *\|/gm)].map((m) => m[1] as string)

it('defines every token the design document names, under its CSS name', () => {
  expect(documented.length).toBeGreaterThan(15)
  const cssName = (token: string) =>
    ['display', 'figure', 'title', 'body', 'meta', 'label'].includes(token)
      ? `--type-${token}`
      : token.startsWith('space-') ||
          token.startsWith('rule-') ||
          token.startsWith('leading') ||
          token === 'touch' ||
          token === 'bar'
        ? `--${token}`
        : `--color-${token}`
  for (const token of documented) expect(css, token).toContain(`${cssName(token)}:`)
})

it('gives every colour a dark value too', () => {
  const dark = css.slice(css.indexOf('prefers-color-scheme: dark'))
  for (const token of ['ink', 'ink-2', 'rule', 'paper', 'wash', 'accent', 'on-accent'])
    expect(dark, token).toContain(`--color-${token}:`)
})
