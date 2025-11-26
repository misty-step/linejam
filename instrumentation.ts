import { isSentryEnabled } from './lib/sentry';

/**
 * Next.js instrumentation hook
 *
 * Initializes Sentry for the appropriate runtime environment.
 * Called by Next.js when the app starts.
 */

export async function register() {
  // Skip Sentry in development entirely for faster startup
  if (process.env.NODE_ENV === 'development') return;

  if (!isSentryEnabled) return;

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
  if (!isSentryEnabled) return;

  const { captureRequestError } = await import('@sentry/nextjs');
  await captureRequestError(error, request, context);
};
