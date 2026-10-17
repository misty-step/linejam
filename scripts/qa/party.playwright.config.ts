import { defineConfig } from '@playwright/test';
import path from 'node:path';

export default defineConfig({
  testDir: '../../tests/e2e',
  testMatch: 'party-chaos.party.ts',
  tsconfig: '../../tsconfig.json',
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 600_000,
  expect: { timeout: 30_000 },
  outputDir: path.resolve('.qa/party/private'),
  reporter: [
    ['line'],
    ['json', { outputFile: path.resolve('.qa/party/private/results.json') }],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,

    trace: 'off',
    screenshot: 'off',
  },
  metadata: { receipt: path.resolve('.qa/party/receipt.json') },
});
