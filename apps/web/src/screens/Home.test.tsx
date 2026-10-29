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
