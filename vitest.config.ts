import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts', 'server/test/**/*.test.ts', 'shared/test/**/*.test.ts'],
    passWithNoTests: true,
  },
})
