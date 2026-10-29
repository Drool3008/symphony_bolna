import type { ThreadMessage } from '@family-health/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client.js'
import { stringsFor } from '../i18n/format.js'
import { cardButtons } from './cardLabels.js'
import { Outcome } from './Outcome.js'
import { PinnedCard } from './PinnedCard.js'

const reply = vi.hoisted(() => vi.fn())
vi.mock('../api/index.js', async (original) => ({
  ...(await original<typeof import('../api/index.js')>()),
  api: { reply },
}))
afterEach(() => {
  cleanup()
  reply.mockReset()
})

/** The card the default take sends Arun (recorded from the stub server). */
const arunsCard: ThreadMessage = {
  id: 'card-1',
  thread: 'rp',
  from: 'agent',
  to: 'rp',
  text: "Amma's Metoprolol was out of stock at Pillar Road. Kazipet Pharmacy has it. OK to pay?",
  language: 'en-IN',
  kind: null,
  card: {
    kind: 'spend_above_threshold',
    amount_inr: 320,
    payee: 'Kazipet Pharmacy',
    medicine: 'Metoprolol',
    strength: '25mg',
    quantity: '60 tablets',
    for: 'Lakshmi',
    wallet_left_inr: 4680,
    why: 'Above the ₹200 you set for asking first.',
    on_timeout: 'hold the order unpaid and call you',
  },
  answer: null,
  answered_at: null,
  timed_out_at: null,
  at: '2026-10-08T18:30:00.000Z',
}
const s = stringsFor('en-IN')

function pinned() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <PinnedCard message={arunsCard} memberId="rp" s={s} />
    </QueryClientProvider>,
  )
}

it('uses the card’s own buttons when it names them, and the reference’s fallback until then', () => {
  expect(cardButtons({ kind: 'spend_above_threshold', buttons: ['Yes', 'No'] })).toEqual(['Yes', 'No'])
  expect(cardButtons(arunsCard.card)).toEqual(['Approve', 'Hold unpaid'])
})

it('sends the label tapped as the answer, and says what happens if nobody answers', async () => {
  reply.mockResolvedValue({ ok: true, delivered: true })
  pinned()
  expect(screen.getByText('hold the order unpaid and call you')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
  await vi.waitFor(() => expect(reply).toHaveBeenCalledWith({ message_id: 'card-1', action: 'Approve' }))
})

it('shows the server’s own reason when a second answer is refused', async () => {
  reply.mockRejectedValue(new ApiError('refused', 'that card is already answered', 409))
  pinned()
  fireEvent.click(screen.getByRole('button', { name: 'Hold unpaid' }))
  expect((await screen.findByRole('alert')).textContent).toBe('that card is already answered')
})

it('marks an answered card with the answer, who gave it and when', () => {
  render(
    <Outcome
      message={{ ...arunsCard, answer: 'Approve', answered_at: arunsCard.at }}
      answeredBy="Arun"
      s={s}
    />,
  )
  expect(screen.getByText('Approve')).toBeTruthy()
  expect(screen.getByText('Arun')).toBeTruthy()
})

it('marks a card nobody answered in time as the agent’s to act on', () => {
  render(<Outcome message={{ ...arunsCard, timed_out_at: arunsCard.at }} answeredBy="Arun" s={s} />)
  expect(screen.getByText('Nobody answered in time')).toBeTruthy()
  expect(screen.getByText('Your agent')).toBeTruthy()
})
