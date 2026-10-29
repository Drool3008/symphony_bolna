import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

/** Unit tests: components and client code in a simulated browser, no server. */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
