import type { APIRequestContext, Page } from '@playwright/test'

/** The browser tests' own backend (playwright.config.ts). */
export const BACKEND = 'http://localhost:8797'

/** A fresh run, through the dev route; never from the member UI. */
export async function resetBackend(request: APIRequestContext) {
  await request.post(`${BACKEND}/api/reset`, { data: { reason: 'browser test' } })
}

export async function moveClock(request: APIRequestContext, to: string) {
  await request.post(`${BACKEND}/api/clock`, { data: { to, source: 'browser test' } })
}

export async function pick(page: Page, name: string) {
  await page.goto('/pick')
  await page.getByRole('button', { name }).click()
}

/** Plays the default take with the dev routes up to Arun's card: two chemists, from the answers on file. */
export async function playTakeToArunsCard(request: APIRequestContext) {
  await request.post(`${BACKEND}/api/clock`, {
    data: { to_next_date: true, source: 'browser test: the refill check' },
  })
  for (const variant of ['chemist_substitute_only', 'chemist_in_stock_kazipet']) {
    let id: string | undefined
    for (let i = 0; i < 100 && !id; i++) {
      const { pending } = (await (await request.get(`${BACKEND}/api/operator/queue`)).json()) as {
        pending: { id: string }[]
      }
      id = pending[0]?.id
      if (!id) await new Promise((r) => setTimeout(r, 100))
    }
    await request.post(`${BACKEND}/api/operator/queue/${id}`, { data: { variant } })
  }
}

/** Reads the stream for a moment from the test runner and returns its events. */
export async function streamEvents(ms = 800): Promise<Record<string, unknown>[]> {
  const ctl = new AbortController()
  const res = await fetch(`${BACKEND}/events`, { signal: ctl.signal })
  const reader = res.body?.getReader()
  let text = ''
  const stop = Date.now() + ms
  while (reader && Date.now() < stop) {
    const next = await Promise.race([reader.read(), new Promise<null>((r) => setTimeout(() => r(null), 100))])
    if (next?.value) text += new TextDecoder().decode(next.value)
    if (next?.done) break
  }
  ctl.abort()
  return text
    .split('\n\n')
    .map((block) => block.split('\n').find((line) => line.startsWith('data: ')))
    .filter((line): line is string => Boolean(line))
    .map((line) => JSON.parse(line.slice(6)) as Record<string, unknown>)
}

/** The id of the card the default take sends Arun. */
export async function arunsCardId(): Promise<string> {
  for (const e of await streamEvents()) {
    const m = e.message as { id: string; thread: string; card: unknown } | undefined
    if (e.type === 'message' && m?.thread === 'rp' && m.card) return m.id
  }
  throw new Error("Arun's card is not on the stream")
}
