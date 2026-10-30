import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client.js'
import { stringsFor } from '../i18n/format.js'
import { lakshmiHome } from '../test/homes.js'
import { Home } from './Home.js'

const home = vi.hoisted(() => ({ current: null as unknown }))
const input = vi.hoisted(() => vi.fn())
vi.mock('../api/index.js', async (original) => ({
  ...(await original<typeof import('../api/index.js')>()),
  api: {
    home: async () => home.current,
    members: async () => ({ members: [lakshmiHome.member] }),
    input,
  },
}))
afterEach(() => {
  cleanup()
  input.mockReset()
})

function draw(language = 'te-IN') {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/home']}>
        <Routes>
          <Route path="/home" element={<Home me={lakshmiHome.member} s={stringsFor(language)} />} />
          <Route path="/agent" element={<h1>Chat</h1>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

it("shows Lakshmi's Metoprolol at 3 days, with its run-out date and the must-not-miss mark, in Telugu", async () => {
  home.current = lakshmiHome
  draw()
  expect(await screen.findByText('Metoprolol')).toBeTruthy()
  expect(screen.getByText('3 రోజులకు సరిపోతాయి')).toBeTruthy()
  expect(screen.getByText(/అయిపోతాయి$/, { selector: '.med-runs-out' })).toBeTruthy()
  expect(screen.getByText('తప్పకుండా వేసుకోవాలి')).toBeTruthy()
  expect(screen.getByText('6 మాత్రలు మిగిలాయి')).toBeTruthy()
})

it('shows the BP check as overdue since the day it fell due, with when it was last done', async () => {
  home.current = lakshmiHome
  draw('en-IN')
  expect(await screen.findByText('BP check')).toBeTruthy()
  expect(screen.getByText('overdue since 4 Sept')).toBeTruthy()
  expect(screen.getByText('last done 6 Jun')).toBeTruthy()
  expect(screen.getByText('every 90 days')).toBeTruthy()
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
  expect(slot.querySelector('.tag-ai')?.textContent).toBe('AI')
})

it('marks three days of cover as low and offers a refill', async () => {
  home.current = lakshmiHome
  draw('en-IN')
  expect((await screen.findByText('3 days left')).className).toContain('chip-low')
  expect(screen.getByText('Tap to order refill')).toBeTruthy()
})

it('asks the agent for a refill in the reference’s words when a medicine is tapped, then opens Chat', async () => {
  input.mockResolvedValue({ ok: true, as: 'input' })
  home.current = lakshmiHome
  draw('en-IN')
  fireEvent.click((await screen.findByText('Metoprolol')).closest('button') as HTMLButtonElement)
  await vi.waitFor(() =>
    expect(input).toHaveBeenCalledWith({ text: 'Please refill Metoprolol 25mg for Lakshmi' }),
  )
  expect(await screen.findByRole('heading', { name: 'Chat' })).toBeTruthy()
})

it('asks the agent to book a test, and shows the server’s reason when it is refused', async () => {
  input.mockRejectedValue(new ApiError('refused', 'text: say something', 400))
  home.current = lakshmiHome
  draw('en-IN')
  fireEvent.click(await screen.findByText('Book this check-up'))
  await vi.waitFor(() => expect(input).toHaveBeenCalledWith({ text: 'Please book my BP check.' }))
  expect((await screen.findByRole('alert')).textContent).toBe('text: say something')
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
