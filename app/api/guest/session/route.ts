import { NextRequest, NextResponse } from 'next/server';
import {
  GUEST_TOKEN_MAX_AGE_SECONDS,
  signGuestToken,
  verifyGuestTokenPayload,
} from '@/lib/guestToken';
import { getServerGuestTokenSecret } from '@/lib/env';
import { createHmac, randomUUID } from 'crypto';
import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';
import { captureServerError } from '@/lib/errorServer';
import { log, logError, logRequest } from '@/lib/logger';
import { signGuestSessionThrottleProof } from '@/lib/guestSessionThrottleProof';

const COOKIE_NAME = 'linejam_guest_token';
const ROUTE = '/api/guest/session';
const GUEST_SESSION_RETRY_AFTER_SECONDS = 10 * 60;
const checkSignedGuestSessionThrottle = makeFunctionReference<
  'mutation',
  { key: string; proof: string },
  { ok: true }
>('guestSessions:checkSignedGuestSessionThrottle');

let convexClient: ConvexHttpClient | null = null;

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const baseContext = {
    method: request.method,
    route: ROUTE,
  };
  const existingOnly = request.nextUrl.searchParams.get('existing') === '1';

  try {
    // Check for existing valid token in cookie
    const existingToken = request.cookies.get(COOKIE_NAME)?.value;

    if (existingToken) {
      try {
        const payload = await verifyGuestTokenPayload(existingToken);
        if (payload.sessionId && payload.rateLimitKey) {
          logRequest({
            ...baseContext,
            status: 200,
            durationMs: elapsedMs(startedAt),
            operation: 'reuseGuestSession',
            reusedExistingToken: true,
          });
          // Valid current token exists, return guestId and token for the
          // in-memory Convex client auth argument.
          return NextResponse.json({
            guestId: payload.guestId,
            token: existingToken,
          });
        }

        const rateLimitKey = deriveGuestSessionRateLimitKey(request);
        const token = await signGuestToken(payload.guestId, {
          sessionId: randomUUID(),
          rateLimitKey,
        });
        const response = NextResponse.json({
          guestId: payload.guestId,
          token,
        });
        setGuestCookie(response, token);
        logRequest({
          ...baseContext,
          status: 200,
          durationMs: elapsedMs(startedAt),
          operation: 'rotateLegacyGuestSession',
          reusedExistingToken: false,
        });
        return response;
      } catch (error) {
        log.warn('Guest session token rejected', {
          ...baseContext,
          operation: 'verifyGuestToken',
          reason: 'invalid_or_expired',
          durationMs: elapsedMs(startedAt),
          errorName: error instanceof Error ? error.name : 'UnknownError',
        });
        // Token invalid/expired - will create new one below
      }
    }

    if (existingOnly) {
      const response = NextResponse.json({ guestId: null, token: null });
      if (existingToken) {
        clearGuestCookie(response);
      }
      logRequest({
        ...baseContext,
        status: 200,
        durationMs: elapsedMs(startedAt),
        operation: 'readExistingGuestSession',
        reusedExistingToken: false,
      });
      return response;
    }

    const throttle = await enforceGuestSessionThrottle(request);
    if (!throttle.allowed) {
      logRequest({
        ...baseContext,
        status: 429,
        durationMs: elapsedMs(startedAt),
        operation: 'createGuestSession',
        result: 'rate_limited',
      });
      return NextResponse.json(
        { error: 'Too many guest sessions. Try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(GUEST_SESSION_RETRY_AFTER_SECONDS),
          },
        }
      );
    }

    // No valid token - create new guest session
    const guestId = randomUUID();
    const token = await signGuestToken(guestId, {
      sessionId: randomUUID(),
      rateLimitKey: throttle.rateLimitKey,
    });

    const response = NextResponse.json({ guestId, token });

    // Set HttpOnly cookie
    setGuestCookie(response, token);

    logRequest({
      ...baseContext,
      status: 200,
      durationMs: elapsedMs(startedAt),
      operation: 'createGuestSession',
      reusedExistingToken: false,
    });

    return response;
  } catch (error) {
    const context = {
      ...baseContext,
      status: 500,
      durationMs: elapsedMs(startedAt),
      operation: 'createGuestSession',
    };
    logError('Request failed', error, context);
    captureServerError(error, context);
    return NextResponse.json(
      { error: 'Failed to create guest session' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const startedAt = Date.now();
  const response = new NextResponse(null, { status: 204 });
  clearGuestCookie(response);
  logRequest({
    method: request.method,
    route: ROUTE,
    status: 204,
    durationMs: elapsedMs(startedAt),
    operation: 'revokeGuestSession',
  });
  return response;
}

function elapsedMs(startedAt: number) {
  return Math.max(0, Date.now() - startedAt);
}

function setGuestCookie(response: NextResponse, token: string) {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: GUEST_TOKEN_MAX_AGE_SECONDS,
    secure: process.env.NODE_ENV === 'production',
  });
}

function clearGuestCookie(response: NextResponse) {
  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    secure: process.env.NODE_ENV === 'production',
  });
}

async function enforceGuestSessionThrottle(
  request: NextRequest
): Promise<{ allowed: true; rateLimitKey: string } | { allowed: false }> {
  const rateLimitKey = deriveGuestSessionRateLimitKey(request);
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL?.trim();

  if (!convexUrl) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'NEXT_PUBLIC_CONVEX_URL is required for guest-session throttling'
      );
    }
    return { allowed: true, rateLimitKey };
  }

  try {
    const proof = await signGuestSessionThrottleProof(
      rateLimitKey,
      getServerGuestTokenSecret()
    );
    await getConvexClient(convexUrl).mutation(checkSignedGuestSessionThrottle, {
      key: rateLimitKey,
      proof,
    });
    return { allowed: true, rateLimitKey };
  } catch (error) {
    if (isRateLimitError(error)) {
      return { allowed: false };
    }
    if (
      isMissingThrottleFunctionError(error) &&
      allowUnsyncedConvexThrottle()
    ) {
      log.warn('Guest session throttle function missing; allowing local run', {
        method: 'GET',
        route: ROUTE,
        operation: 'guestSessionThrottle',
        convexUrl,
      });
      return { allowed: true, rateLimitKey };
    }
    throw error;
  }
}

function getConvexClient(convexUrl: string) {
  if (!convexClient) {
    convexClient = new ConvexHttpClient(convexUrl);
  }
  return convexClient;
}

function deriveGuestSessionRateLimitKey(request: NextRequest): string {
  const ip = getClientIp(request);
  const secret = getServerGuestTokenSecret();
  const digest = createHmac('sha256', secret).update(ip).digest('base64url');
  return `guestSession:${digest.slice(0, 32)}`;
}

function getClientIp(request: NextRequest): string {
  const appPlatformIp = request.headers.get('do-connecting-ip')?.trim();
  if (appPlatformIp) return appPlatformIp;

  // DigitalOcean App Platform owns do-connecting-ip in production. Do not
  // let callers select durable throttle buckets through forwarded headers.
  if (process.env.NODE_ENV === 'production') return 'unknown';

  for (const header of ['cf-connecting-ip', 'x-real-ip']) {
    const value = request.headers.get(header)?.trim();
    if (value) return value;
  }

  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim();
    if (first) return first;
  }

  return 'unknown';
}

function isRateLimitError(error: unknown) {
  return /rate limit exceeded/i.test(extractErrorMessage(error));
}

function isMissingThrottleFunctionError(error: unknown) {
  return /Could not find public function for 'guestSessions:checkSignedGuestSessionThrottle'/i.test(
    extractErrorMessage(error)
  );
}

function extractErrorMessage(error: unknown) {
  if (
    error &&
    typeof error === 'object' &&
    'name' in error &&
    (error as { name: unknown }).name === 'ConvexError' &&
    'data' in error &&
    typeof (error as { data: unknown }).data === 'string'
  ) {
    return (error as { data: string }).data;
  }

  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return String(error);
}

function allowUnsyncedConvexThrottle() {
  return (
    process.env.NODE_ENV !== 'production' &&
    process.env.CI !== 'true' &&
    process.env.LINEJAM_ALLOW_UNSYNCED_CONVEX_THROTTLE === '1'
  );
}
