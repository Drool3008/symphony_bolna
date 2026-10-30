import { expect, test } from '@playwright/test'
import { moveClock, pick, resetBackend } from './helpers.js'

test.beforeEach(async ({ request }) => resetBackend(request))

test('Lakshmi sees Metoprolol at 3 days, and moving the clock counts it down without a reload', async ({
  page,
  request,
}) => {
  await pick(page, 'Lakshmi')
  const row = page.getByRole('listitem').filter({ hasText: 'Metoprolol' })
  await expect(row.locator('.chip-low')).toHaveText('3 రోజులకు సరిపోతాయి')
  await moveClock(request, '2026-10-07T10:00:00+05:30')
  await expect(row.locator('.chip-low')).toHaveText('2 రోజులకు సరిపోతాయి')
  await expect(page.getByText('బుధవారం')).toBeVisible()
})

test('Lakshmi sees her BP check overdue', async ({ page }) => {
  await pick(page, 'Lakshmi')
  const row = page.getByRole('listitem').filter({ hasText: 'BP check' })
  await expect(row.locator('.test-overdue')).toContainText('గడువు దాటింది')
})

test('Arun sees his inhaler counted in doses, and his mother’s medicines under her consent', async ({
  page,
}) => {
  await pick(page, 'Arun')
  await expect(page.getByText('20 doses left')).toBeVisible()
  await expect(page.getByRole('region', { name: "Lakshmi's medicines" })).toBeVisible()
})

test('Kavya does not see her mother’s medicines: her consent shares status only', async ({ page }) => {
  await pick(page, 'Kavya')
  await expect(page.getByText('Levothyroxine')).toBeVisible()
  await expect(page.getByText('Metoprolol')).toHaveCount(0)
})
