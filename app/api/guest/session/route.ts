import { NextRequest, NextResponse } from 'next/server';
import { signGuestToken, verifyGuestToken } from '@/lib/guestToken';
import { randomUUID } from 'crypto';
import { captureServerError } from '@/lib/errorServer';
import { log, logError, logRequest } from '@/lib/logger';

const COOKIE_NAME = 'linejam_guest_token';
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds
const ROUTE = '/api/guest/session';

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const baseContext = {
    method: request.method,
    route: ROUTE,
  };

  try {
    // Check for existing valid token in cookie
    const existingToken = request.cookies.get(COOKIE_NAME)?.value;

    if (existingToken) {
      try {
        const guestId = await verifyGuestToken(existingToken);
        logRequest({
          ...baseContext,
          status: 200,
          durationMs: elapsedMs(startedAt),
          operation: 'reuseGuestSession',
          reusedExistingToken: true,
        });
        // Valid token exists, return guestId and token
        return NextResponse.json({ guestId, token: existingToken });
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

    // No valid token - create new guest session
    const guestId = randomUUID();
    const token = await signGuestToken(guestId);

    const response = NextResponse.json({ guestId, token });

    // Set HttpOnly cookie
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: COOKIE_MAX_AGE,
      secure: process.env.NODE_ENV === 'production',
    });

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

function elapsedMs(startedAt: number) {
  return Math.max(0, Date.now() - startedAt);
}
