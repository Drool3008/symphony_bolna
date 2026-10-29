import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { stringsFor } from '../i18n/format.js'
import { lakshmiHome } from '../test/homes.js'
import { Home } from './Home.js'

const home = vi.hoisted(() => ({ current: null as unknown }))
vi.mock('../api/index.js', async (original) => ({
  ...(await original<typeof import('../api/index.js')>()),
  api: {
    home: async () => home.current,
    members: async () => ({ members: [lakshmiHome.member] }),
  },
}))
afterEach(cleanup)

function draw(language = 'te-IN') {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <Home me={lakshmiHome.member} s={stringsFor(language)} />
    </QueryClientProvider>,
  )
}

it("shows Lakshmi's Metoprolol at 3 days, with its run-out date and the must-not-miss mark, in Telugu", async () => {
  home.current = lakshmiHome
  draw()
  expect(await screen.findByText('Metoprolol')).toBeTruthy()
  expect(screen.getByText('3')).toBeTruthy()
  expect(screen.getByText('రోజులకు సరిపోతాయి')).toBeTruthy()
  expect(screen.getByText(/అయిపోతాయి$/)).toBeTruthy()
  expect(screen.getByText('తప్పకుండా వేసుకోవాలి')).toBeTruthy()
  expect(screen.getByText('6 మాత్రలు మిగిలాయి')).toBeTruthy()
})

it('shows the BP check as overdue since the day it fell due, with when it was last done', async () => {
  home.current = lakshmiHome
  draw('en-IN')
  expect(await screen.findByText('BP check')).toBeTruthy()
  expect(screen.getByText('overdue since 4 Sept')).toBeTruthy()
  expect(screen.getByText('last done 6 Jun · every 90 days')).toBeTruthy()
})

it('gives a test due next year its year', async () => {
  const spirometry = { id: 'test_2', name: 'Spirometry', every_days: 365, last_done: '2026-07-18' }
  home.current = {
    ...lakshmiHome,
    tests: [{ ...spirometry, overdue: false, days_until_due: 285, next_due: '2027-07-18' }],
  }
  draw('en-IN')
  expect(await screen.findByText('due 18 Jul 2027')).toBeTruthy()
})

it('draws nothing for the latest word while the server sends null', async () => {
  home.current = lakshmiHome
  draw('en-IN')
  await screen.findByText('Metoprolol')
  expect(screen.queryByText('Latest from your agent')).toBeNull()
  expect(screen.queryByRole('region', { name: 'Latest from your agent' })).toBeNull()
})

it('fills the latest word in once the server sends one, marked as the agent’s', async () => {
  home.current = { ...lakshmiHome, latest_agent_word: 'Your tablets are ordered.' }
  draw('en-IN')
  const slot = await screen.findByRole('region', { name: 'Latest from your agent' })
  expect(slot.textContent).toContain('Your tablets are ordered.')
  expect(slot.textContent).toContain('Your agent')
})

it('says the stock is as counted, once the clock has moved past the day it was counted', async () => {
  home.current = {
    ...lakshmiHome,
    today: '2026-10-07',
    medicines: lakshmiHome.medicines.map((m) => ({ ...m, days_of_cover: 2 })),
  }
  draw('en-IN')
  expect(await screen.findByText('6 pills left when counted on 6 Oct')).toBeTruthy()
})
