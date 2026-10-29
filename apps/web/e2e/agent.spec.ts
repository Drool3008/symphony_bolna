import { expect, test } from '@playwright/test'
import { arunsCardId, BACKEND, pick, playTakeToArunsCard, resetBackend } from './helpers.js'

test.beforeEach(async ({ request }) => resetBackend(request))

test("Arun's thread fills as the take happens, with his card pinned on top", async ({ page, request }) => {
  await pick(page, 'Arun')
  await page.getByRole('link', { name: 'Chat' }).click()
  await expect(page.getByText('No messages yet.')).toBeVisible()
  await playTakeToArunsCard(request)
  const pinned = page.getByRole('region', { name: 'Needs your answer' })
  await expect(pinned.getByText('Spend needs your OK')).toBeVisible()
  await expect(pinned.getByText('Kazipet Pharmacy')).toBeVisible()
  await expect(page.getByText('OK to pay?')).toBeVisible()
})

test("Lakshmi's thread gets the agent's Telugu message once Arun has answered", async ({
  browser,
  request,
}) => {
  const lakshmi = await (await browser.newContext()).newPage()
  await pick(lakshmi, 'Lakshmi')
  await lakshmi.getByRole('link', { name: 'చాట్' }).click()
  await playTakeToArunsCard(request)
  // Arun answers through the API here; tapping the card comes with the next commit.
  await request.post(`${BACKEND}/api/reply`, {
    headers: { 'X-Member-Id': 'rp' },
    data: { message_id: await arunsCardId(), action: 'Approve' },
  })
  await expect(lakshmi.getByText(/మీ మాత్రలు ఆర్డర్ అయ్యాయి/)).toBeVisible()
  await expect(lakshmi.getByText('మీ సహాయకుడు', { exact: false }).first()).toBeVisible()
})
