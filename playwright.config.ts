import { defineConfig, devices } from '@playwright/test';
import { BASE_URL } from './src/config';

// There is no storageState here on purpose — the session lives in a persistent
// Chrome profile instead, one per role. See tests/fixtures.ts for why.

export default defineConfig({
  testDir: './tests',
  // The wizard talks to the server on every Continue, and the final submit
  // fans out to quote requests. Give a full run room to breathe.
  timeout: 10 * 60_000,
  expect: { timeout: 20_000 },
  // Every run writes to the shared dev database; keep it serial.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    viewport: { width: 1920, height: 1000 },
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
    // trace/screenshot/video are driven by the fixture, not by these options,
    // because the persistent-context fixture replaces Playwright's own.
    ignoreHTTPSErrors: true,
  },
  projects: [
    // --- sign-in, one per role ------------------------------------------
    // `npm run auth:strata` / `npm run auth:broker` — a real window opens,
    // you sign in, and that role's profile keeps the session.
    {
      name: 'auth:strata',
      testMatch: /auth\.setup\.ts/,
      metadata: { role: 'strata' },
      use: { ...devices['Desktop Chrome'], headless: false },
    },
    {
      name: 'auth:broker',
      testMatch: /auth\.setup\.ts/,
      metadata: { role: 'broker' },
      use: { ...devices['Desktop Chrome'], headless: false },
    },

    // --- runs -------------------------------------------------------------
    // Each replays the wizard using that role's saved session.
    {
      name: 'strata',
      testIgnore: /auth\.setup\.ts/,
      metadata: { role: 'strata' },
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'broker',
      testIgnore: /auth\.setup\.ts/,
      metadata: { role: 'broker' },
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
