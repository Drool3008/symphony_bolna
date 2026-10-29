import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defineConfig, devices } from '@playwright/test'

const WEB_PORT = 5173
/** A spare port, so a backend someone is already running on 8787 is left alone. */
const BACKEND_PORT = 8797
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`

/**
 * Browser tests against the dev server and a backend of their own: the
 * scripted provider and a fresh temporary database each run. Results go to
 * the system's temp folder, so nothing a run leaves behind lands in the
 * repository.
 */
export default defineConfig({
  testDir: 'e2e',
  outputDir: join(tmpdir(), 'vantari-web-playwright'),
  reporter: 'list',
  workers: 1,
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    ...devices['iPhone 13'],
    browserName: 'chromium',
  },
  webServer: [
    {
      command: 'npm run start -w @family-health/server',
      cwd: '../..',
      url: `${BACKEND_URL}/api/members`,
      env: {
        MODEL_PROVIDER: 'stub',
        STUB_THINK_MS: '0',
        PORT: String(BACKEND_PORT),
        DATABASE_PATH: join(tmpdir(), `vantari-web-e2e-${process.pid}.sqlite`),
      },
      reuseExistingServer: false,
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      env: { BACKEND_URL },
      reuseExistingServer: false,
    },
  ],
})
