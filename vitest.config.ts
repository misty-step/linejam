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
      ],
      thresholds: {
        lines: 80,
        functions: 70, // v8 counts arrow callbacks as functions, inflating denominator
        branches: 80,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
