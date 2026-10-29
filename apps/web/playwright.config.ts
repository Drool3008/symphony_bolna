import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defineConfig, devices } from '@playwright/test'

const WEB_PORT = 5173

/**
 * Browser tests against the dev server. Results go to the system's temp
 * folder, so nothing a run leaves behind lands in the repository.
 */
export default defineConfig({
  testDir: 'e2e',
  outputDir: join(tmpdir(), 'vantari-web-playwright'),
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    ...devices['iPhone 13'],
    browserName: 'chromium',
  },
  webServer: {
    command: `npx vite --port ${WEB_PORT} --strictPort`,
    url: `http://localhost:${WEB_PORT}`,
    reuseExistingServer: false,
  },
})
