import type { MembersResponse } from '@family-health/shared'
import { expect, test } from '@playwright/test'

test('the page origin reaches the backend through the dev proxy', async ({ page }) => {
  await page.goto('/')
  const res = await page.request.get('/api/members')
  expect(res.status()).toBe(200)
  const body = (await res.json()) as MembersResponse
  expect(body.members.map((m) => m.name)).toEqual(['Lakshmi', 'Arun', 'Kavya'])
})

test('seeded media comes through the same origin', async ({ page }) => {
  const res = await page.request.get('/media/rx-patient.png')
  expect(res.status()).toBe(200)
  expect(res.headers()['content-type']).toContain('image/png')
})
