import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';
import { captureCanaryException, isCanaryEnabled } from '@/lib/canaryServer';
import { log, logError, logRequest } from '@/lib/logger';

const CONVEX_HEALTH_TIMEOUT_MS = 1_500;
const ROUTE = '/api/health';

export async function GET() {
  const startedAt = Date.now();

  try {
    const convexStatus = await checkConvex();
    const envChecks = checkEnvVars();
    const serviceHealthy =
      envChecks.guestTokenSecret &&
      envChecks.convexUrl &&
      convexStatus === 'connected';
    const canaryReady = envChecks.canaryIngestKey;
    const status = serviceHealthy ? 200 : 503;
    const body = {
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
    };

    logRequest({
      method: 'GET',
      route: ROUTE,
      status,
      durationMs: elapsedMs(startedAt),
      convex: convexStatus,
      observabilityStatus: canaryReady ? 'ready' : 'degraded',
    });

    return Response.json(body, {
      status,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    await logFailure(error, startedAt);
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

  const startedAt = Date.now();

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
    log.warn('Convex health ping failed; marking unreachable', {
      method: 'GET',
      route: ROUTE,
      operation: 'convexHealthPing',
      durationMs: elapsedMs(startedAt),
      errorName: error instanceof Error ? error.name : 'UnknownError',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return 'unreachable';
  }
}

/**
 * Best-effort logging that tolerates missing or slow observability transport.
 */
async function logFailure(error: unknown, startedAt: number) {
  const context = {
    source: 'api.health',
    method: 'GET',
    route: ROUTE,
    status: 500,
    durationMs: elapsedMs(startedAt),
  };

  logError('Healthcheck failed', error, context);

  void captureCanaryException(error, context);
}

function elapsedMs(startedAt: number) {
  return Math.max(0, Date.now() - startedAt);
}
