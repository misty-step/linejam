import { captureCanaryException } from '@/lib/canaryServer';

/**
 * Next.js instrumentation hook
 *
 * Linejam ships no extra runtime bootstrap today. Explicit Canary reporting
 * happens in request hooks, error boundaries, and client observers.
 */

export async function register() {}

export const onRequestError = async (
  error: Error,
  request: {
    path: string;
    method: string;
    headers: Record<string, string>;
  },
  context: {
    routerKind: 'Pages Router' | 'App Router';
    routePath: string;
    routeType: 'render' | 'route' | 'action' | 'middleware';
    renderSource?:
      | 'react-server-components'
      | 'react-server-components-payload';
    revalidateReason?: 'on-demand' | 'stale';
  }
) => {
  void captureCanaryException(error, {
    source: 'nextjs.onRequestError',
    path: request.path,
    method: request.method,
    routerKind: context.routerKind,
    routePath: context.routePath,
    routeType: context.routeType,
    renderSource: context.renderSource,
    revalidateReason: context.revalidateReason,
  });
};
