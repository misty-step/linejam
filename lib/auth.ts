import { useUser as useClerkUser } from '@clerk/nextjs';
import { useConvexAuth } from 'convex/react';
import { useCallback, useEffect, useState } from 'react';
import { captureError } from '@/lib/error';
import {
  toErrorReportable,
  type ErrorReportable,
  type ErrorReportContext,
} from '@/lib/errorCore';
import {
  GUEST_SESSION_RATE_LIMIT_MESSAGE,
  GuestSessionFetcher,
  defaultGuestSessionFetcher,
  isGuestSessionRateLimitError,
} from '@/lib/guestSession';

const CLERK_GUEST_FALLBACK_MS = 5_000;
const CLERK_LOAD_TIMEOUT_MESSAGE =
  'Clerk did not load in time; continuing with guest play';

export type ClerkUserSummary = {
  id: string;
  fullName?: string | null;
  firstName?: string | null;
  imageUrl?: string | null;
  primaryEmailAddress?: { emailAddress?: string } | null;
};

export type ClerkAuthState = {
  user: ClerkUserSummary | null;
  isLoaded: boolean;
};

export type ConvexAuthState = {
  isLoading: boolean;
  isAuthenticated: boolean;
};

export type UseUserAuthDependencies = {
  useClerk?: () => ClerkAuthState;
  useConvex?: () => ConvexAuthState;
  onError?: (error: ErrorReportable, context?: ErrorReportContext) => void;
};

/**
 * Hook for managing user identity (Clerk or guest).
 *
 * Guest play is the runtime, so an unavailable Clerk frontend must not hold
 * anonymous users on a loading screen forever. If Clerk does not settle within
 * the bounded bootstrap window, the hook reports the outage and continues with
 * the existing guest-session path. A late Clerk session still takes precedence.
 *
 * @param fetcher - Injectable fetcher for guest session (default: API fetch).
 *                  Tests can inject a mock to avoid network calls.
 * @param deps - Injectable auth providers and error reporting seam.
 */
export function useUser(
  fetcher: GuestSessionFetcher = defaultGuestSessionFetcher,
  deps?: UseUserAuthDependencies
) {
  const useClerk = deps?.useClerk ?? useClerkUser;
  const useConvex = deps?.useConvex ?? useConvexAuth;
  const clerkAuth = useClerk();
  const clerkUser = clerkAuth.user;
  const isClerkLoaded = clerkAuth.isLoaded;
  const convexAuth = useConvex();
  const isConvexAuthLoading = convexAuth.isLoading;
  const isConvexAuthenticated = convexAuth.isAuthenticated;
  const reportError = deps?.onError ?? captureError;
  const [guestId, setGuestId] = useState<string | null>(null);
  const [guestToken, setGuestToken] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [clerkLoadTimedOut, setClerkLoadTimedOut] = useState(false);

  useEffect(() => {
    if (isClerkLoaded || globalThis.window === undefined) return;

    const timeout = window.setTimeout(() => {
      const error = new Error(CLERK_LOAD_TIMEOUT_MESSAGE);
      error.name = 'ClerkLoadTimeoutError';
      setClerkLoadTimedOut(true);
      reportError(error, { operation: 'clerkLoadTimeout' });
    }, CLERK_GUEST_FALLBACK_MS);

    return () => window.clearTimeout(timeout);
  }, [isClerkLoaded, reportError]);

  useEffect(() => {
    if (
      (!isClerkLoaded && !clerkLoadTimedOut) ||
      globalThis.window === undefined
    )
      return;
    if (isLoaded && !clerkUser) return;
    let isStale = false;

    // Signed-in users don't need guest-session setup to proceed.
    if (clerkUser) {
      if (isConvexAuthLoading) {
        queueMicrotask(() => {
          if (isStale) return;
          setAuthError(null);
          setIsLoaded(false);
        });
        return () => {
          isStale = true;
        };
      }

      queueMicrotask(() => {
        if (isStale) return;
        setGuestId(null);
        setGuestToken(null);

        if (!isConvexAuthenticated) {
          reportError(new Error('Signed-in user missing Convex auth session'), {
            operation: 'convexAuthUnavailable',
          });
          setAuthError(
            'Your account signed in, but the game server could not verify it. Please refresh and try again.'
          );
          setIsLoaded(true);
          return;
        }

        setAuthError(null);
        setIsLoaded(true);
      });
      return () => {
        isStale = true;
      };
    }

    fetcher
      .fetch()
      .then((data) => {
        if (isStale) return;
        setGuestId(data.guestId);
        setGuestToken(data.token);
        setAuthError(null);
        setIsLoaded(true);
      })
      .catch((cause) => {
        if (isStale) return;
        const error = toErrorReportable(cause);
        setGuestId(null);
        setGuestToken(null);
        if (isGuestSessionRateLimitError(error)) {
          setAuthError(GUEST_SESSION_RATE_LIMIT_MESSAGE);
        } else {
          reportError(error, { operation: 'fetchGuestSession' });
          setAuthError('Unable to connect. Please check your connection.');
        }
        setIsLoaded(true);
      });
    return () => {
      isStale = true;
    };
  }, [
    isClerkLoaded,
    clerkLoadTimedOut,
    clerkUser,
    isLoaded,
    fetcher,
    retryCount,
    isConvexAuthLoading,
    isConvexAuthenticated,
    reportError,
  ]);

  const retryAuth = useCallback(() => {
    setAuthError(null);
    setIsLoaded(false);
    setRetryCount((c) => c + 1);
  }, []);

  const isLoading = !isLoaded;

  return {
    clerkUser,
    guestId,
    guestToken,
    isLoading,
    isAuthenticated: !!clerkUser,
    displayName: clerkUser?.fullName || clerkUser?.firstName || 'Guest',
    authError,
    retryAuth,
  };
}
