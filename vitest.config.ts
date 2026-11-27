import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

// Two projects, zero cloud credentials:
//   worker — runs inside workerd (Miniflare) against the real Worker and both
//            Durable Objects with their SQLite storage.
//   faces  — runs in Node and drives the CLI and MCP server as child
//            processes against a live local `wrangler dev`.
export default defineConfig({
  test: {
    projects: [
      {
        plugins: [
          cloudflareTest({
            wrangler: { configPath: './wrangler.jsonc' },
            miniflare: {
              bindings: {
                GUEST_TOKEN_SECRET: 'local-test-guest-secret-0123456789abcdef',
                LINEJAM_ADMIN_KEY: 'local-test-admin-key-0123456789abcdef',
                RETENTION_GC_ENABLED: '1',
              },
            },
          }),
        ],
        test: { name: 'worker', include: ['tests/worker/**/*.test.ts'] },
      },
      {
        test: {
          name: 'faces',
          include: ['tests/faces/**/*.test.ts'],
          globalSetup: ['tests/faces/server.ts'],
          testTimeout: 60_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
});
