import type { ThreadMessage } from '@family-health/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client.js'
import { stringsFor } from '../i18n/format.js'
import { cardButtons, cardTone, pastTense } from './cardLabels.js'
import { DecisionCard } from './DecisionCard.js'

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

function card(message: ThreadMessage = arunsCard) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <DecisionCard message={message} memberId="rp" s={s} />
    </QueryClientProvider>,
  )
}

it('uses the card’s own buttons when it names them, and the reference’s fallback until then', () => {
  expect(cardButtons({ kind: 'spend_above_threshold', buttons: ['Yes', 'No'] })).toEqual(['Yes', 'No'])
  expect(cardButtons(arunsCard.card)).toEqual(['Approve', 'Hold unpaid'])
})

it('sends the label tapped as the answer, and says what happens if nobody answers', async () => {
  reply.mockResolvedValue({ ok: true, delivered: true })
  card()
  expect(screen.getByText('hold the order unpaid and call you')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
  await vi.waitFor(() => expect(reply).toHaveBeenCalledWith({ message_id: 'card-1', action: 'Approve' }))
})

it('shows the server’s own reason when a second answer is refused', async () => {
  reply.mockRejectedValue(new ApiError('refused', 'that card is already answered', 409))
  card()
  fireEvent.click(screen.getByRole('button', { name: 'Hold unpaid' }))
  expect((await screen.findByRole('alert')).textContent).toBe('that card is already answered')
})

it('shows an open card as the member’s decision, with its facts, amount and reason', () => {
  const { container } = card()
  expect(container.querySelector('.dc-open')).toBeTruthy()
  expect(screen.getByText('Your decision')).toBeTruthy()
  expect(screen.getByText('Human')).toBeTruthy()
  expect(screen.getByText('₹320')).toBeTruthy()
  expect(screen.getByText('Chemist').nextElementSibling?.textContent).toBe('Kazipet Pharmacy')
  expect(screen.getByText('Above the ₹200 you set for asking first.')).toBeTruthy()
})

it('reads an answer as yes or as something else, and a receipt as a record', () => {
  const answered = (answer: string) => ({ ...arunsCard, answer, answered_at: arunsCard.at })
  expect(cardTone(arunsCard)).toBe('open')
  expect(cardTone(answered('Approve'))).toBe('yes')
  expect(cardTone(answered('Yes, book it'))).toBe('yes')
  expect(cardTone(answered('Hold unpaid'))).toBe('other')
  expect(cardTone(answered('Not now'))).toBe('other')
  expect(cardTone({ ...arunsCard, timed_out_at: arunsCard.at })).toBe('timed_out')
  expect(cardTone({ ...arunsCard, card: { kind: 'order_receipt', buttons: ['Approve'] } })).toBe('record')
  expect(pastTense('Approve')).toBe('Approved')
  expect(pastTense('Something new')).toBe('Something new')
})

it('turns green once the member said yes, and says what they chose and when', () => {
  const { container } = card({ ...arunsCard, answer: 'Approve', answered_at: arunsCard.at })
  expect(container.querySelector('.dc-yes')).toBeTruthy()
  expect(screen.getByText('Approved')).toBeTruthy()
  expect(screen.getByText(/^You chose Approve at 12:00\s?am$/i)).toBeTruthy()
  expect(screen.queryByRole('button')).toBeNull()
})

it('stays grey for a hold', () => {
  const { container } = card({ ...arunsCard, answer: 'Hold unpaid', answered_at: arunsCard.at })
  expect(container.querySelector('.dc-other')).toBeTruthy()
  expect(screen.getByText('Held unpaid')).toBeTruthy()
})

it('marks a card nobody answered in time with what the agent does instead', () => {
  card({ ...arunsCard, timed_out_at: arunsCard.at })
  expect(screen.getByText('No answer')).toBeTruthy()
  expect(screen.getByText('No answer: hold the order unpaid and call you')).toBeTruthy()
  expect(screen.queryByRole('button')).toBeNull()
})

it('never offers buttons on a record of something done', () => {
  card({
    ...arunsCard,
    card: { kind: 'order_receipt', buttons: ['Approve'], total_inr: 120, receipt_no: 'R-1' },
  })
  expect(screen.getByText('Done')).toBeTruthy()
  expect(screen.getByText('Receipt R-1')).toBeTruthy()
  expect(screen.queryByRole('button')).toBeNull()
})
