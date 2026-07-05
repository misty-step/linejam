import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    pool: 'threads', // Threads avoids forks pool teardown hang on Node 22
    globals: true,
    environment: 'node', // Default to node; DOM tests use // @vitest-environment happy-dom
    setupFiles: './tests/setup.ts',

    // Explicit timeouts prevent hanging (scry pattern)
    testTimeout: 10000,
    hookTimeout: 10000,
    teardownTimeout: 1000, // Force quick exit on cleanup stall

    // Sequential execution avoids Node 22 forks teardown race
    maxWorkers: 1,
    include: ['**/*.{test,spec}.{js,ts,jsx,tsx}'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/tests/e2e/**',
      '**/.worktrees/**', // Exclude git worktrees - they have their own test environments
      '**/.agents/**',
      '**/.claude/**',
      '**/.codex/**',
      '**/.pi/**',
      '**/.spellbook/**', // Harness config, not app code
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov', 'json-summary'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/.next/**',
        '**/tests/**',
        '**/*.config.{js,ts}',
        '**/*.d.ts',
        '**/convex/migrations.ts', // One-time migration scripts, not runtime code
        '**/.agents/**',
        '**/.claude/**',
        '**/.codex/**',
        '**/.pi/**',
        '**/.spellbook/**', // Harness config, not app code
      ],
      // linejam-911: ratcheted from the legacy 85% floor. Actual measured
      // coverage as of this ratchet (pnpm test:ci): statements 91.44%,
      // branches 86.32%, functions 92.75%, lines 92.9% -- these thresholds
      // sit a few points below that so the gate has headroom against
      // normal test-suite churn without being able to silently regress
      // back toward 85%. Ratchet up again (never down) as coverage grows;
      // see docs/testing.md.
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 84,
        statements: 89,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
