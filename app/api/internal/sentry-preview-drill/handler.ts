import { createHash, timingSafeEqual } from 'node:crypto';
import { captureException, flush } from '@sentry/nextjs';
import { NextResponse } from 'next/server';

const FORBIDDEN_SENTINEL = 'LINEJAM_SENTRY_FORBIDDEN_SENTINEL';

export interface SentryPreviewDrillRouteDependencies {
  captureException: typeof captureException;
  flush: typeof flush;
}

export interface SentryPreviewDrillRoute {
  (request: Request): Promise<NextResponse>;
}

const defaultSentryPreviewDrillRouteDependencies: SentryPreviewDrillRouteDependencies =
  {
    captureException,
    flush,
  };

class SentryPreviewDrillError extends Error {
  constructor() {
    super('Linejam preview privacy drill');
    this.name = 'SentryPreviewDrillError';
  }
}

function isAuthorized(request: Request) {
  const expected = process.env.SENTRY_PREVIEW_DRILL_TOKEN?.trim();
  const authorization = request.headers.get('authorization');
  if (!expected || !authorization?.startsWith('Bearer ')) return false;

  const supplied = authorization.slice('Bearer '.length);
  const expectedDigest = createHash('sha256').update(expected).digest();
  const suppliedDigest = createHash('sha256').update(supplied).digest();
  return timingSafeEqual(expectedDigest, suppliedDigest);
}

export function createSentryPreviewDrillRoute(
  dependencies: SentryPreviewDrillRouteDependencies = defaultSentryPreviewDrillRouteDependencies
): SentryPreviewDrillRoute {
  return async function sentryPreviewDrillRoute(request: Request) {
    if (
      process.env.LINEJAM_DEPLOY_ENVIRONMENT !== 'preview' ||
      process.env.NEXT_PUBLIC_SENTRY_ENABLED !== '1' ||
      !process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() ||
      !isAuthorized(request)
    ) {
      return new NextResponse(null, { status: 404 });
    }

    dependencies.captureException(new SentryPreviewDrillError(), {
      tags: {
        operation: 'sentryPreviewDrill',
        forbidden: FORBIDDEN_SENTINEL,
      },
      extra: {
        prompt: FORBIDDEN_SENTINEL,
      },
      contexts: {
        rejected: {
          poem: FORBIDDEN_SENTINEL,
        },
      },
    });

    const flushed = await dependencies.flush(2_000);
    return NextResponse.json(
      { captured: flushed },
      { status: flushed ? 202 : 503 }
    );
  };
}

export const POST = createSentryPreviewDrillRoute();
