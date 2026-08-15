import { captureCheckIn, flush } from '@sentry/nextjs';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';
import type { ConvexEnvHealthReport } from '@/convex/lib/env';
import { resolveDeploymentId } from '@/lib/deploymentId';
import { isValidSentryDsn } from '@/lib/env';
import { signGuestSessionThrottleProof } from '@/lib/guestSessionThrottleProof';
import { isValidServerActionEncryptionKey } from '@/lib/serverActionEncryptionKey';
import { captureServerError } from '@/lib/errorServer';
import { log, logError, logRequest } from '@/lib/logger';

const CONVEX_HEALTH_TIMEOUT_MS = 3_000;
const ROUTE = '/api/health';
const GUEST_PARITY_KEY = 'guestSession:deployment-readiness';
const SENTRY_HEALTH_MONITOR_SLUG = 'linejam-production-health';
const SENTRY_HEALTH_MONITOR_CONFIG = {
  schedule: { type: 'crontab' as const, value: '*/5 * * * *' },
  checkinMargin: 2,
  maxRuntime: 1,
  timezone: 'UTC',
};

export async function GET() {
  const startedAt = Date.now();

  try {
    const {
      status: convexStatus,
      report: convexEnv,
      guestTokenParity,
      deploymentMatch,
    } = await checkConvex();
    const envChecks = checkEnvVars(guestTokenParity, deploymentMatch);
    const serviceHealthy =
      envChecks.guestTokenSecret &&
      envChecks.guestTokenParity &&
      envChecks.convexDeploymentMatch &&
      envChecks.convexUrl &&
      convexStatus === 'connected' &&
      convexEnv?.ok === true;
    const sentryReady = envChecks.sentryEnabled;
    const observabilityReady = sentryReady;
    const deployment = deploymentReadiness();
    const status = serviceHealthy && deployment.ready ? 200 : 503;
    const body = {
      status: status === 200 ? 'ok' : 'unhealthy',
      deployment: {
        id: deployment.id,
        skewProtection: deployment.skewProtection,
        stableServerActions: deployment.stableServerActions,
      },
      convex: convexStatus,
      convexEnv: convexEnv?.capabilities ?? null,
      env: {
        nodeEnv: process.env.NODE_ENV ?? 'development',
        ...envChecks,
      },
      observability: {
        status: observabilityReady ? 'ready' : 'degraded',
        sentryEnabled: sentryReady,
      },
      timestamp: new Date().toISOString(),
    };

    logRequest({
      method: 'GET',
      route: ROUTE,
      status,
      durationMs: elapsedMs(startedAt),
      convex: convexStatus,
      observabilityStatus: observabilityReady ? 'ready' : 'degraded',
    });

    await reportHealthCheckIn({
      status: status === 200 ? 'alive' : 'error',
      summary:
        status === 200
          ? 'linejam health route ok'
          : 'linejam health route degraded',
      routeStatus: status,
      startedAt,
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

function deploymentReadiness() {
  const id = resolveDeploymentId(process.env.NEXT_DEPLOYMENT_ID) ?? null;
  const skewProtection = id !== null;
  const stableServerActions = isValidServerActionEncryptionKey(
    process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY
  );
  const required = process.env.LINEJAM_DEPLOY_ENVIRONMENT === 'production';

  return {
    id,
    skewProtection,
    stableServerActions,
    ready: !required || (skewProtection && stableServerActions),
  };
}

/**
 * Check presence of critical environment variables.
 * Does not expose actual values, only boolean presence.
 */
function checkEnvVars(
  guestTokenParity: boolean,
  convexDeploymentMatch: boolean
) {
  return {
    guestTokenSecret: !!process.env.GUEST_TOKEN_SECRET,
    guestTokenParity,
    convexDeploymentMatch,
    convexUrl: !!process.env.NEXT_PUBLIC_CONVEX_URL,
    clerkPublishableKey: !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    sentryEnabled:
      process.env.NEXT_PUBLIC_SENTRY_ENABLED === '1' &&
      isValidSentryDsn(process.env.NEXT_PUBLIC_SENTRY_DSN),
  };
}

type ConvexHealth = {
  status: 'connected' | 'unreachable' | 'skipped';
  report: ConvexEnvHealthReport | null;
  guestTokenParity: boolean;
  deploymentMatch: boolean;
};

/**
 * One query proves Convex is reachable and returns the deployment's retained
 * capability report. The report's `ok` verdict includes the required-name
 * manifest, so configuration drift fails this route instead of degrading
 * silently. Network errors are "unreachable", never a 500 crash.
 */
async function checkConvex(): Promise<ConvexHealth> {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return {
      status: 'skipped',
      report: null,
      guestTokenParity: false,
      deploymentMatch: false,
    };
  }

  const startedAt = Date.now();

  try {
    const client = new ConvexHttpClient(convexUrl);
    const [report, guestTokenParity] = (await Promise.race([
      Promise.all([
        client.query(api.health.capabilities),
        checkGuestTokenParity(client),
      ]),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(
            new Error(
              `Convex health ping timed out after ${CONVEX_HEALTH_TIMEOUT_MS}ms`
            )
          );
        }, CONVEX_HEALTH_TIMEOUT_MS);
      }),
    ])) as [ConvexEnvHealthReport, boolean];
    return {
      status: 'connected',
      report,
      guestTokenParity,
      deploymentMatch: deploymentMatchesWebTarget(convexUrl, report),
    };
  } catch (error) {
    log.warn('Convex health ping failed; marking unreachable', {
      method: 'GET',
      route: ROUTE,
      operation: 'convexHealthPing',
      durationMs: elapsedMs(startedAt),
      errorName: error instanceof Error ? error.name : 'UnknownError',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return {
      status: 'unreachable',
      report: null,
      guestTokenParity: false,
      deploymentMatch: false,
    };
  }
}

function deploymentMatchesWebTarget(
  convexUrl: string,
  report: ConvexEnvHealthReport
) {
  const declared = process.env.LINEJAM_DEPLOY_ENVIRONMENT?.trim();
  if (
    declared !== 'production' &&
    declared !== 'preview' &&
    declared !== 'development'
  ) {
    return false;
  }
  const expectedEnvironment = declared;

  try {
    return (
      report.deployment.markerValid &&
      report.environment === expectedEnvironment &&
      report.deployment.url !== null &&
      new URL(report.deployment.url).origin === new URL(convexUrl).origin
    );
  } catch {
    return false;
  }
}

async function checkGuestTokenParity(client: ConvexHttpClient) {
  const secret = process.env.GUEST_TOKEN_SECRET?.trim();
  if (!secret) return false;

  try {
    const proof = await signGuestSessionThrottleProof(GUEST_PARITY_KEY, secret);
    await client.mutation(api.guestSessions.checkSignedGuestSessionThrottle, {
      key: GUEST_PARITY_KEY,
      proof,
      dryRun: true,
    });
    return true;
  } catch (error) {
    log.warn('Guest token parity probe failed; marking unhealthy', {
      method: 'GET',
      route: ROUTE,
      operation: 'guestTokenParity',
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
    return false;
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

  captureServerError(error, context);
  reportSentryHealthCheckIn('error', startedAt);
}

async function reportHealthCheckIn(input: {
  status: 'alive' | 'error';
  summary: string;
  routeStatus: number;
  startedAt: number;
}) {
  reportSentryHealthCheckIn(
    input.status === 'error' ? 'error' : 'ok',
    input.startedAt
  );
}

function reportSentryHealthCheckIn(status: 'ok' | 'error', startedAt: number) {
  if (
    process.env.NEXT_PUBLIC_SENTRY_ENABLED !== '1' ||
    !isValidSentryDsn(process.env.NEXT_PUBLIC_SENTRY_DSN)
  ) {
    return;
  }

  try {
    captureCheckIn(
      {
        monitorSlug: SENTRY_HEALTH_MONITOR_SLUG,
        status,
        duration: elapsedMs(startedAt) / 1_000,
      },
      SENTRY_HEALTH_MONITOR_CONFIG
    );
    void flush(2_000)
      .then((flushed) => {
        if (!flushed) {
          logSentryHealthReportingFailure('FlushTimeout');
        }
      })
      .catch((reportingError: unknown) => {
        logSentryHealthReportingFailure(
          reportingError instanceof Error
            ? reportingError.name
            : 'UnknownReportingError'
        );
      });
  } catch (reportingError) {
    logSentryHealthReportingFailure(
      reportingError instanceof Error
        ? reportingError.name
        : 'UnknownReportingError'
    );
  }
}

function logSentryHealthReportingFailure(errorName: string) {
  log.error('Sentry health check-in failed', {
    operation: 'healthCheckIn',
    failureCode: 'reportingFailure',
    errorName,
  });
}

function elapsedMs(startedAt: number) {
  return Math.max(0, Date.now() - startedAt);
}
