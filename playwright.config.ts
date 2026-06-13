import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for end-to-end tests against the deployed
 * FlowSavvy / Tempo Calendar app.
 *
 * Authentication is handled by saving the storage state once via
 * `npm run test:e2e:auth` and reusing it on every subsequent run.
 *
 * Override the target URL with `E2E_BASE_URL`. Default is the
 * deployed Vercel production app.
 */
const BASE_URL =
  process.env.E2E_BASE_URL || 'https://tempo-calendar-tomers-team.vercel.app';
const AUTH_FILE = './e2e/.auth/user.json';

export default defineConfig({
  testDir: './e2e/flows',
  // One spec at a time keeps output readable and avoids hammering the
  // deployed app with concurrent fetches. Each spec uses the same
  // saved storage state, so they all run as the same signed-in user.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL: BASE_URL,
    // The captured storage state is the same file for every test, so
    // they all run as the same signed-in user. If the file is missing
    // we throw a clear error asking the user to run the auth capture.
    storageState: AUTH_FILE,
    viewport: { width: 1440, height: 900 },
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
