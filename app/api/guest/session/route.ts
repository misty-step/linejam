import { NextRequest, NextResponse } from 'next/server';
import { signGuestToken, verifyGuestToken } from '@/lib/guestToken';
import { randomUUID } from 'crypto';
import { logger } from '@/lib/logger';
import { captureError } from '@/lib/error';

const COOKIE_NAME = 'linejam_guest_token';
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

export async function GET(request: NextRequest) {
  try {
    // Check for existing valid token in cookie
    const existingToken = request.cookies.get(COOKIE_NAME)?.value;

    if (existingToken) {
      try {
        const guestId = await verifyGuestToken(existingToken);
        // Valid token exists, return guestId and token
        return NextResponse.json({ guestId, token: existingToken });
      } catch (error) {
        // Token invalid/expired - will create new one below
        logger.debug(
          { error, operation: 'verifyGuestToken' },
          'Invalid guest token, creating new one'
        );
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

    return response;
  } catch (error) {
    captureError(error, { operation: 'createGuestSession' });
    logger.error(
      { error, operation: 'createGuestSession' },
      'Guest session API error'
    );
    return NextResponse.json(
      { error: 'Failed to create guest session' },
      { status: 500 }
    );
  }
}
