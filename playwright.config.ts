/**
 * End-to-end tests: the real API (fresh database) and the production build of the app,
 * served with the production Content-Security-Policy.
 *
 *   npm run e2e                      uses Playwright's Chromium (npx playwright install chromium)
 *   E2E_BROWSER=msedge npm run e2e   uses an installed Microsoft Edge instead
 */
import { defineConfig, devices } from '@playwright/test'

import { E2E_API_PORT, E2E_WEB_PORT } from './e2e/settings.mjs'

const channel = process.env.E2E_BROWSER || undefined

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${E2E_WEB_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], channel } }],
  webServer: [
    {
      command: 'node e2e/start-api.mjs',
      url: `http://127.0.0.1:${E2E_API_PORT}/health/ready`,
      timeout: 120_000,
      reuseExistingServer: false,
      stdout: 'pipe',
    },
    {
      command: `npm run build && npx vite preview --host 127.0.0.1 --port ${E2E_WEB_PORT} --strictPort`,
      url: `http://127.0.0.1:${E2E_WEB_PORT}`,
      timeout: 180_000,
      reuseExistingServer: false,
      env: { VITE_DEV_API_TARGET: `http://127.0.0.1:${E2E_API_PORT}` },
    },
  ],
})
