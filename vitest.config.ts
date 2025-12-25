import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    pool: 'forks', // Required: tests that modify process.env deadlock with threads pool
    poolOptions: {
      forks: {
        singleFork: false,
        isolate: true,
      },
    },
    teardownTimeout: 1000, // Force exit after 1s teardown
    globals: true,
    environment: 'happy-dom',
    setupFiles: './tests/setup.ts',
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
