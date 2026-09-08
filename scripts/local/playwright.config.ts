import { defineConfig } from '@playwright/test';
import base from '../../playwright.config';

export default defineConfig(base, {
  testDir: '../../tests/e2e',
  testMatch: [
    'early-smoke.spec.ts',
    'game-flow.spec.ts',
    'guest-flow.evidence.spec.ts',
  ],
  globalSetup: '../../playwright.global.setup.ts',
  tsconfig: '../../tsconfig.json',
  workers: 1,
  retries: 0,
  outputDir: '/artifacts/qa/test-results',
  reporter: [
    ['line'],
    ['html', { outputFolder: '/artifacts/qa/report', open: 'never' }],
    ['json', { outputFile: '/artifacts/qa/results.json' }],
  ],
  use: {
    ...base.use,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: undefined,
});
