/**
 * Next.js instrumentation hook
 *
 * Initializes Sentry for the appropriate runtime environment.
 * Called by Next.js when the app starts.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

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
  const { captureRequestError } = await import('@sentry/nextjs');
  await captureRequestError(error, request, context);
};
