import { expect, test } from '@playwright/test'

test('a fresh phone picks a member, and the app opens as theirs, in their language', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/pick$/)
  await page.getByRole('button', { name: 'Lakshmi' }).click()
  await expect(page.locator('.head-member-name')).toHaveText('Lakshmi')
  await expect(page.locator('html')).toHaveAttribute('lang', 'te-IN')
  await page.reload()
  await expect(page.locator('.head-member-name')).toHaveText('Lakshmi')
})
