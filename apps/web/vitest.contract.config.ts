import { defineConfig } from 'vitest/config'

/**
 * Contract checks: the client's own API code against a real backend on the
 * scripted provider, started by contract/server.ts on a spare port with a
 * temporary database.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['contract/**/*.test.ts'],
    globalSetup: ['contract/server.ts'],
    testTimeout: 20_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
})
