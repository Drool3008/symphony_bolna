import { expect, test } from '@playwright/test'

/**
 * The stream code running in a real browser, through the dev proxy: unit
 * tests use a stand-in fetch, which forgives what a browser's fetch does not.
 */
test('the live stream connects in the browser and goes live on sync', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    // Served by Vite in the page; a variable keeps the compiler from resolving it on disk.
    const path = '/src/api/stream.ts'
    const { LiveStream } = (await import(/* @vite-ignore */ path)) as typeof import('../src/api/stream.js')
    const stream = new LiveStream({ base: '' })
    const types: string[] = []
    stream.on((e) => types.push(e.type))
    stream.start()
    for (let i = 0; i < 100 && stream.status !== 'live'; i++) await new Promise((r) => setTimeout(r, 50))
    const status = stream.status
    stream.stop()
    return { status, types }
  })
  expect(result.status).toBe('live')
  expect(result.types).toContain('sync')
})
