import { defineConfig } from '@playwright/test';
import path from 'node:path';
import base from '../../playwright.config';

const output = path.join(
  process.env.LINEJAM_LOCAL_ARTIFACTS || '/artifacts',
  'qa'
);

export default defineConfig(base, {
  testDir: '../../tests/e2e',
  testMatch: [
    'entry-ui.spec.ts',
    'early-smoke.spec.ts',
    'game-flow.spec.ts',
    'guest-flow.evidence.spec.ts',
  ],
  globalSetup: '../../playwright.global.setup.ts',
  tsconfig: '../../tsconfig.json',
  workers: 1,
  retries: 0,
  outputDir: path.join(output, 'test-results'),
  reporter: [
    ['line'],
    ['html', { outputFolder: path.join(output, 'report'), open: 'never' }],
    ['json', { outputFile: path.join(output, 'results.json') }],
  ],
  use: {
    ...base.use,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: undefined,
});
