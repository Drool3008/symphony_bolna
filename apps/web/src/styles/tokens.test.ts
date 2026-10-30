import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'

const here = import.meta.dirname
const css = readFileSync(join(here, 'tokens.css'), 'utf8')
const doc = readFileSync(join(here, '../../docs/design-tokens.md'), 'utf8')

/** The token names in the first column of the tables under one `## ` heading of docs/design-tokens.md. */
function documented(section: string): string[] {
  const start = doc.indexOf(`## ${section}`)
  const end = doc.indexOf('\n## ', start + 1)
  const text = doc.slice(start, end === -1 ? undefined : end)
  return [...text.matchAll(/^\| `([a-z0-9-]+)` *\|/gm)].map((m) => m[1] as string)
}

const colours = documented('Colour')
const type = documented('Type')
const shape = documented('Shape and space')
const dark = css.slice(css.indexOf('prefers-color-scheme: dark'))

it('defines every token the design document names, under its CSS name', () => {
  expect(colours.length).toBeGreaterThan(20)
  expect(type).toEqual(['app', 'pane', 'brand', 'card', 'body', 'meta', 'badge'])
  expect(shape.length).toBeGreaterThan(8)
  for (const token of colours) expect(css, token).toContain(`--color-${token}:`)
  for (const token of type) expect(css, token).toContain(`--type-${token}:`)
  for (const token of shape) expect(css, token).toContain(`--${token}:`)
  expect(css).toContain('--leading-telugu:')
})

it('gives every colour a dark value too', () => {
  for (const token of colours) expect(dark, token).toContain(`--color-${token}:`)
})

it('uses no custom property that tokens.css does not define', () => {
  const defined = new Set([...css.matchAll(/(--[a-z0-9-]+):/g)].map((m) => m[1]))
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name)
      return statSync(path).isDirectory() ? files(path) : /\.(css|tsx)$/.test(name) ? [path] : []
    })
  for (const file of files(join(here, '..'))) {
    const used = [...readFileSync(file, 'utf8').matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1])
    for (const name of used) expect(defined.has(name), `${name} in ${file}`).toBe(true)
  }
})
