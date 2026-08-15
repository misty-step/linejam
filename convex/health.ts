import { query } from './_generated/server';
import { getConvexEnvHealthReport } from './lib/env';

/**
 * One round trip for app-side health: resolving this query proves the
 * deployment is reachable, and the payload reports whether every retained
 * capability has its required environment configured.
 * app/api/health/route.ts folds `ok` into its own verdict, so configuration
 * drift turns the public health route and scheduled production monitor red.
 */
export const capabilities = query({
  args: {},
  handler: async () => getConvexEnvHealthReport(),
});
