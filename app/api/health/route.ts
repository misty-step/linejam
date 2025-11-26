import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';

export async function GET() {
  try {
    const convexStatus = await checkConvex();

    return Response.json(
      {
        status: 'ok',
        convex: convexStatus,
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV ?? 'development',
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    await logFailure(error);
    return Response.json(
      { status: 'error' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

/**
 * Ping Convex without allowing network errors to explode the health endpoint.
 * Treats Convex as "unreachable" instead of throwing so CI/unit tests stay hermetic.
 */
async function checkConvex() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) return 'skipped';

  try {
    const client = new ConvexHttpClient(convexUrl);
    await client.query(api.health.ping);
    return 'connected';
  } catch (error) {
    // Keep response successful but surface degraded status.
    console.warn('Convex health ping failed; marking unreachable', error);
    return 'unreachable';
  }
}

/**
 * Best-effort logging that tolerates environments where server-only modules
 * are unavailable (e.g., Vitest).
 */
async function logFailure(error: unknown) {
  try {
    const { logger } = await import('@/lib/logger');
    logger.error({ error }, 'Healthcheck failed');
  } catch {
    console.error('Healthcheck failed', error);
  }

  try {
    await import('@sentry/nextjs')
      .then((Sentry) => Sentry.captureException?.(error))
      .catch(() => undefined);
  } catch {
    // Sentry not available in this runtime; ignore.
  }
}
