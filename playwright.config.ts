import { defineConfig, devices } from '@playwright/test';

/**
 * See https://playwright.dev/docs/test-configuration.
 *
 * Port configuration: Uses PORT_E2E env var with 3333 default to avoid
 * conflicts with other dev servers on 3000. Override with:
 *   PORT_E2E=3334 pnpm test:e2e
 */
const PORT = process.env.PORT_E2E || '3333';

export default defineConfig({
  testDir: './tests/e2e',

  /* Set timeout for each test */
  timeout: 120000, // 2 minutes per test

  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 2 : undefined,

  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',

  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: `http://localhost:${PORT}`,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Screenshot on failure */
    screenshot: 'only-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Run your local dev server before starting the tests */

  webServer: {
    command: process.env.CI
      ? `PORT=${PORT} pnpm start:next`
      : `PORT=${PORT} pnpm dev`,

    url: `http://localhost:${PORT}`,

    reuseExistingServer: !process.env.CI,

    timeout: 120000,
  },
});
