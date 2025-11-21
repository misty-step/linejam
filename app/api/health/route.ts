export async function GET() {
  try {
    return Response.json(
      {
        status: 'ok',
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
