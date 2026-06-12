import { defineConfig, devices } from '@playwright/test';
import { vercelProtectionBypassHeaders } from './tests/e2e/support/vercelProtection';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL?.trim();

if (!BASE_URL) {
  throw new Error(
    'PLAYWRIGHT_BASE_URL is required for smoke runs. Example: PLAYWRIGHT_BASE_URL=https://www.linejam.app pnpm test:e2e:smoke'
  );
}

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /prod-smoke\.spec\.ts/,
  globalSetup: './playwright.global.setup.ts',
  timeout: 120000,
  fullyParallel: false,
  forbidOnly: true,
  retries: 2,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: BASE_URL,
    extraHTTPHeaders: vercelProtectionBypassHeaders(),
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
