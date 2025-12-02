import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';

export async function GET() {
  try {
    const convexStatus = await checkConvex();
    const envChecks = checkEnvVars();

    // Consider unhealthy if critical env vars are missing
    const healthy = envChecks.guestTokenSecret && envChecks.convexUrl;

    return Response.json(
      {
        status: healthy ? 'ok' : 'unhealthy',
        convex: convexStatus,
        env: {
          nodeEnv: process.env.NODE_ENV ?? 'development',
          ...envChecks,
        },
        timestamp: new Date().toISOString(),
      },
      {
        status: healthy ? 200 : 503,
        headers: { 'Cache-Control': 'no-store' },
      }
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
 * Check presence of critical environment variables.
 * Does not expose actual values, only boolean presence.
 */
function checkEnvVars() {
  return {
    guestTokenSecret: !!process.env.GUEST_TOKEN_SECRET,
    convexUrl: !!process.env.NEXT_PUBLIC_CONVEX_URL,
    clerkPublishableKey: !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  };
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
