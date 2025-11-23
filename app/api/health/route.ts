import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../convex/_generated/api';

export async function GET() {
  try {
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    let convexStatus = 'skipped';

    if (convexUrl) {
      const client = new ConvexHttpClient(convexUrl);
      // @ts-expect-error - api.health might not be generated yet
      await client.query(api.health.ping);
      convexStatus = 'connected';
    }

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
    const { logger } = await import('@/lib/logger');
    await import('@sentry/nextjs')
      .then((Sentry) => Sentry.captureException?.(error))
      .catch(() => undefined);
    logger.error({ error }, 'Healthcheck failed');
    return Response.json(
      { status: 'error' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
