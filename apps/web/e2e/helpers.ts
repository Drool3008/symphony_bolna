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
