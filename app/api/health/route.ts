import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';
import { captureCanaryException, isCanaryEnabled } from '@/lib/canaryServer';

const CONVEX_HEALTH_TIMEOUT_MS = 1_500;

export async function GET() {
  try {
    const convexStatus = await checkConvex();
    const envChecks = checkEnvVars();
    const serviceHealthy =
      envChecks.guestTokenSecret &&
      envChecks.convexUrl &&
      convexStatus === 'connected';
    const canaryReady = envChecks.canaryIngestKey;

    return Response.json(
      {
        status: serviceHealthy ? 'ok' : 'unhealthy',
        convex: convexStatus,
        env: {
          nodeEnv: process.env.NODE_ENV ?? 'development',
          ...envChecks,
        },
        observability: {
          status: canaryReady ? 'ready' : 'degraded',
          canaryIngestKey: canaryReady,
        },
        timestamp: new Date().toISOString(),
      },
      {
        status: serviceHealthy ? 200 : 503,
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
    canaryIngestKey: isCanaryEnabled(),
  };
}

/**
 * Ping Convex without allowing network errors to explode the health endpoint.
 * Treat network errors as "unreachable" so the route can return an explicit
 * unhealthy signal instead of a 500 crash.
 */
async function checkConvex() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) return 'skipped';

  try {
    const client = new ConvexHttpClient(convexUrl);
    await Promise.race([
      client.query(api.health.ping),
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(
            new Error(
              `Convex health ping timed out after ${CONVEX_HEALTH_TIMEOUT_MS}ms`
            )
          );
        }, CONVEX_HEALTH_TIMEOUT_MS);
      }),
    ]);
    return 'connected';
  } catch (error) {
    // Keep response successful but surface degraded status.
    console.warn('Convex health ping failed; marking unreachable', error);
    return 'unreachable';
  }
}

/**
 * Best-effort logging that tolerates missing or slow observability transport.
 */
async function logFailure(error: unknown) {
  console.error('Healthcheck failed', error);

  void captureCanaryException(error, {
    source: 'api.health',
  });
}
