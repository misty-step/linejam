import {
  forwardToBackend,
  type DurableObjectNamespaceLike,
} from '@parlor/cloudflare';
import nextWorker, {
  type OpenNextContext,
  type OpenNextEnv,
} from 'open-next-worker';
import { BACKEND_BASE_PATH } from './backend';

export { LinejamBackend } from './backend';

type Env = OpenNextEnv & {
  readonly LINEJAM_BACKEND: DurableObjectNamespaceLike;
};

/**
 * Wrangler entry point: `/backend/*` goes to the Convex-compatible Durable
 * Object, everything else to the OpenNext build of the Next.js app.
 */
const worker = {
  fetch(request: Request, env: Env, ctx: OpenNextContext): Promise<Response> {
    return (
      forwardToBackend(request, env.LINEJAM_BACKEND, BACKEND_BASE_PATH) ??
      nextWorker.fetch(request, env, ctx)
    );
  },
};

export default worker;
