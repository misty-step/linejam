import {
  forwardToBackend,
  type DurableObjectNamespaceLike,
} from '@parlor/cloudflare';
import nextWorker, {
  type OpenNextContext,
  type OpenNextEnv,
} from 'open-next-worker';
import { BACKEND_BASE_PATH } from './backend';
import {
  setAsyncLocalStorageAsyncContextStrategy,
  wrapRequestHandler,
} from '@sentry/cloudflare';
import { workerSentryOptions, type SentryBindings } from './sentry';
import {
  validateProductionBindings,
  type ReleaseEnvironment,
} from '../lib/env';

export { LinejamBackend } from './backend';

type Env = OpenNextEnv &
  ReleaseEnvironment &
  SentryBindings & {
    readonly LINEJAM_BACKEND: DurableObjectNamespaceLike;
  };

type Context = OpenNextContext &
  NonNullable<Parameters<typeof wrapRequestHandler>[0]['context']>;
setAsyncLocalStorageAsyncContextStrategy();

/**
 * Wrangler entry point: `/backend/*` goes to the Convex-compatible Durable
 * Object, everything else to the OpenNext build of the Next.js app.
 */
const worker = {
  fetch(request: Request, env: Env, ctx: Context): Promise<Response> {
    try {
      validateProductionBindings(env);
    } catch {
      // No binding values or player data in this fail-closed response.
      return Promise.resolve(
        Response.json(
          { status: 'unavailable', reason: 'production_configuration' },
          { status: 503, headers: { 'Cache-Control': 'no-store' } }
        )
      );
    }
    // Error capture only: leave native bindings, context and WebSockets intact.
    return wrapRequestHandler(
      { request, options: workerSentryOptions(env), context: ctx },
      () =>
        forwardToBackend(request, env.LINEJAM_BACKEND, BACKEND_BASE_PATH) ??
        nextWorker.fetch(request, env, ctx)
    );
  },
};

export default worker;
