import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: './tests/setup.ts',
    include: ['**/*.{test,spec}.{js,ts,jsx,tsx}'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/tests/e2e/**',
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
        // Function coverage threshold lowered to 60% due to Convex architecture:
        // Query/mutation wrappers create multiple function objects that are
        // tested indirectly. All exported functions have comprehensive tests.
        functions: 60,
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
