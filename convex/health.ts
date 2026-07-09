import { query } from './_generated/server';
import { getConvexEnvHealthReport } from './lib/env';

/**
 * One round trip for app-side health: resolving this query proves the
 * deployment is reachable, and the payload reports whether every required
 * capability (guest token verification, AI line generation) has its env
 * configured. app/api/health/route.ts folds `ok` into its own verdict, so a
 * prod deployment missing a required env var turns the public health route —
 * and the scheduled Production Health Monitor — red instead of staying green.
 */
export const capabilities = query({
  args: {},
  handler: async () => getConvexEnvHealthReport(),
});
