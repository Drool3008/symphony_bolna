import { cleanup, render } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { App } from './App.js'

afterEach(cleanup)

it('draws nothing until a design direction is chosen', () => {
  const { container } = render(<App />)
  expect(container.innerHTML).toBe('')
})
