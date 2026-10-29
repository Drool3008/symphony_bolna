import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client.js'
import { stringsFor } from '../i18n/format.js'
import { Composer } from './Composer.js'

const input = vi.hoisted(() => vi.fn())
vi.mock('../api/index.js', async (original) => ({
  ...(await original<typeof import('../api/index.js')>()),
  api: { input },
}))
afterEach(() => {
  cleanup()
  input.mockReset()
})

it('sends a typed line to /api/input and lets the server decide what it is', async () => {
  input.mockResolvedValue({ ok: true, as: 'reply' })
  render(<Composer s={stringsFor('en-IN')} />)
  const box = screen.getByLabelText('Message…')
  fireEvent.change(box, { target: { value: '  Yes, go ahead  ' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send' }))
  await vi.waitFor(() => expect(input).toHaveBeenCalledWith({ text: 'Yes, go ahead' }))
  await vi.waitFor(() => expect((box as HTMLTextAreaElement).value).toBe(''))
})

it('keeps the line and shows the server’s reason when it is refused', async () => {
  input.mockRejectedValue(new ApiError('refused', 'text: say something', 400))
  render(<Composer s={stringsFor('te-IN')} />)
  const box = screen.getByLabelText('సందేశం…')
  fireEvent.change(box, { target: { value: 'నమస్తే' } })
  fireEvent.click(screen.getByRole('button', { name: 'పంపండి' }))
  expect((await screen.findByRole('alert')).textContent).toBe('text: say something')
  expect((box as HTMLTextAreaElement).value).toBe('నమస్తే')
})

it('sends nothing for an empty line', () => {
  render(<Composer s={stringsFor('en-IN')} />)
  expect((screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement).disabled).toBe(true)
})
