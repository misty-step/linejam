import { defineConfig, mergeConfig } from 'vitest/config';
import base from './vitest.config';

/**
 * Runs the unchanged Convex function tests against the Cloudflare Durable
 * Object runtime (`@parlor/cloudflare`) instead of convex-test's in-memory
 * backend. Same tests, same modules; only the backend implementation differs.
 */
const config = mergeConfig(
  base,
  defineConfig({
    resolve: { alias: { 'convex-test': '@parlor/cloudflare/testing' } },
  })
);
// mergeConfig concatenates arrays; select exactly the Convex suite.
config.test = { ...config.test, include: ['tests/convex/**/*.test.ts'] };

export default config;
