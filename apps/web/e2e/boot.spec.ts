import { PRODUCT_NAME } from '@family-health/shared'
import { expect, test } from '@playwright/test'

test('the page boots and names the product from shared/', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(PRODUCT_NAME)
})
