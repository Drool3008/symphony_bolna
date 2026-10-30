import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { resetIdentityForTests } from '../api/identity.js'
import { IdentityProvider } from './identity.js'
import { MemberApp } from './MemberApp.js'
import { Picker } from './Picker.js'

vi.mock('../api/index.js', async (original) => ({
  ...(await original<typeof import('../api/index.js')>()),
  api: {
    members: async () => ({
      members: [
        { id: 'patient', name: 'Lakshmi', role: 'patient', language: 'te-IN' },
        { id: 'rp', name: 'Arun', role: 'responsible_person', language: 'en-IN' },
        { id: 'member_3', name: 'Kavya', role: 'family', language: 'en-IN' },
      ],
    }),
  },
}))

beforeEach(() => {
  window.localStorage.clear()
  resetIdentityForTests()
})
afterEach(cleanup)

function app(at: string) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <IdentityProvider>
        <MemoryRouter initialEntries={[at]}>
          <Routes>
            <Route path="/pick" element={<Picker />} />
            <Route path="*" element={<MemberApp>{({ me }) => <h1>{me.name}</h1>}</MemberApp>} />
          </Routes>
        </MemoryRouter>
      </IdentityProvider>
    </QueryClientProvider>,
  )
}

it('sends a phone with no member to the picker, labelled as a development identity', async () => {
  app('/')
  expect(await screen.findByText('Development identity')).toBeTruthy()
  await screen.findByRole('button', { name: 'Lakshmi' })
  expect(screen.getAllByRole('button').map((b) => b.id || b.getAttribute('aria-labelledby'))).toEqual([
    'pick-patient',
    'pick-rp',
    'pick-member_3',
  ])
  expect(screen.getByRole('button', { name: 'Lakshmi', description: 'Patient' })).toBeTruthy()
  expect(
    screen.getByRole('button', { name: 'Arun', description: 'Manages the family health and the wallet' }),
  ).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Kavya', description: 'Family member' })).toBeTruthy()
})

it("makes the app the picked member's, in their language, and remembers it", async () => {
  app('/pick')
  fireEvent.click(await screen.findByRole('button', { name: 'Lakshmi' }))
  expect(await screen.findByRole('heading', { name: 'Lakshmi' })).toBeTruthy()
  expect(document.documentElement.lang).toBe('te-IN')
  expect(window.localStorage.getItem('member-id')).toBe('patient')
})

it('opens straight into the app for a member already picked', async () => {
  window.localStorage.setItem('member-id', 'rp')
  resetIdentityForTests()
  app('/')
  expect(await screen.findByRole('heading', { name: 'Arun' })).toBeTruthy()
  expect(document.documentElement.lang).toBe('en-IN')
})
