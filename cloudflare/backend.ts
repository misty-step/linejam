import { createConvexBackend } from '@parlor/cloudflare';
import authConfig from '../convex/auth.config';
import crons from '../convex/crons';
import schema from '../convex/schema';
import { modules } from './modules.generated';

/** Where the Worker serves the backend; clients use `<origin>/backend` as their Convex URL. */
export const BACKEND_BASE_PATH = '/backend';

// Convex reads these names; the Worker already holds the same values under
// its web names. This replaces scripts/ci/bootstrap-convex-env.mjs for the
// Durable Object backend.
process.env.SENTRY_DSN ??= process.env.NEXT_PUBLIC_SENTRY_DSN;
process.env.SENTRY_RELEASE ??= process.env.NEXT_DEPLOYMENT_ID;

/**
 * Linejam's Convex deployment on one SQLite Durable Object. The function
 * modules, schema, crons, HTTP routes and auth config are the same files
 * Convex Cloud ran.
 */
export const LinejamBackend = createConvexBackend({
  app: {
    schema,
    modules,
    crons,
    http: async () => (await import('../convex/http')).default,
  },
  auth: authConfig,
  basePath: BACKEND_BASE_PATH,
  adminKeyBinding: 'LINEJAM_BACKEND_ADMIN_KEY',
  redactErrors: (env) => env['LINEJAM_DEPLOY_ENVIRONMENT'] === 'production',
  deploymentName: 'linejam',
});
