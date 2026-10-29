import { expect, test } from '@playwright/test'
import { arunsCardId, BACKEND, pick, playTakeToArunsCard, resetBackend, streamText } from './helpers.js'

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

test("Arun's card answers once and locks on his screen and on a second browser on his id", async ({
  browser,
  request,
}) => {
  const first = await (await browser.newContext()).newPage()
  const second = await (await browser.newContext()).newPage()
  for (const page of [first, second]) {
    await pick(page, 'Arun')
    await page.getByRole('link', { name: 'Chat' }).click()
  }
  await playTakeToArunsCard(request)
  for (const page of [first, second])
    await expect(page.getByRole('button', { name: 'Approve' })).toBeVisible()

  await first.getByRole('button', { name: 'Approve' }).click()
  for (const page of [first, second]) {
    await expect(page.getByRole('button', { name: 'Approve' })).toHaveCount(0)
    await expect(page.getByRole('region', { name: 'Needs your answer' })).toHaveCount(0)
    await expect(page.locator('.outcome')).toContainText('Approve')
    await expect(page.locator('.outcome .mark')).toHaveText('● Arun')
  }
})

test('a second answer is refused, and that screen shows the server’s reason', async ({
  browser,
  request,
}) => {
  await playTakeToArunsCard(request)
  // A phone that has not heard the card was answered: it is served the real
  // stream as it stood before the first tap, so it still shows the card open.
  const frozen = await streamText()
  const stale = await (await browser.newContext()).newPage()
  await stale.route(
    (url) => url.pathname === '/events',
    async (route) => {
      // A first connection gets the frozen stream (React's development mode
      // opens it twice); a reconnect, which asks ?since=, hangs, as on a
      // phone that lost its signal.
      if (new URL(route.request().url()).searchParams.has('since')) return
      await route.fulfill({ status: 200, headers: { 'Content-Type': 'text/event-stream' }, body: frozen })
    },
  )
  const fresh = await (await browser.newContext()).newPage()
  for (const page of [fresh, stale]) {
    await pick(page, 'Arun')
    await page.getByRole('link', { name: 'Chat' }).click()
    await expect(page.getByRole('button', { name: 'Approve' })).toBeVisible()
  }
  await fresh.getByRole('button', { name: 'Approve' }).click()
  await expect(fresh.locator('.outcome')).toContainText('Approve')
  await stale.getByRole('button', { name: 'Hold unpaid' }).click()
  await expect(stale.getByRole('alert')).toHaveText('that card is already answered')
})
