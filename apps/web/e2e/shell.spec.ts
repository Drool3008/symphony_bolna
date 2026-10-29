import { expect, test, type Page } from '@playwright/test'

async function pick(page: Page, name: string) {
  await page.goto('/pick')
  await page.getByRole('button', { name }).click()
}

test("Lakshmi's tabs are in Telugu, and there is no wallet", async ({ page }) => {
  await pick(page, 'Lakshmi')
  const tabs = page.getByRole('navigation').getByRole('link')
  await expect(tabs).toHaveText(['హోమ్', 'చాట్', 'కుటుంబం'])
})

test("Arun's tabs are in English, and the wallet waits for its routes", async ({ page }) => {
  await pick(page, 'Arun')
  await expect(page.getByRole('navigation').getByRole('link')).toHaveText(['Home', 'Chat', 'Family'])
  await page.goto('/wallet')
  await expect(page).toHaveURL(/\/home$/)
})

test("the header shows the family's date from the stream, not the browser's", async ({ page }) => {
  await pick(page, 'Kavya')
  await expect(page.getByText('Tuesday, 6 October')).toBeVisible()
})
