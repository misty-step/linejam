import { useUser as useClerkUser } from '@clerk/nextjs';
import { useConvexAuth } from 'convex/react';
import { useCallback, useEffect, useState } from 'react';
import { captureError } from '@/lib/error';
import {
  GUEST_SESSION_RATE_LIMIT_MESSAGE,
  GuestSessionFetcher,
  defaultGuestSessionFetcher,
  isGuestSessionRateLimitError,
} from '@/lib/guestSession';

const CLERK_GUEST_FALLBACK_MS = 5_000;
const CLERK_LOAD_TIMEOUT_MESSAGE =
  'Clerk did not load in time; continuing with guest play';

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
 */
export function useUser(
  fetcher: GuestSessionFetcher = defaultGuestSessionFetcher
) {
  const { user: clerkUser, isLoaded: isClerkLoaded } = useClerkUser();
  const {
    isLoading: isConvexAuthLoading,
    isAuthenticated: isConvexAuthenticated,
  } = useConvexAuth();
  const [guestId, setGuestId] = useState<string | null>(null);
  const [guestToken, setGuestToken] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [clerkLoadTimedOut, setClerkLoadTimedOut] = useState(false);

  useEffect(() => {
    if (isClerkLoaded || typeof window === 'undefined') return;

    const timeout = window.setTimeout(() => {
      const error = new Error(CLERK_LOAD_TIMEOUT_MESSAGE);
      error.name = 'ClerkLoadTimeoutError';
      captureError(error, { operation: 'clerkLoadTimeout' });
      setClerkLoadTimedOut(true);
    }, CLERK_GUEST_FALLBACK_MS);

    return () => window.clearTimeout(timeout);
  }, [isClerkLoaded]);

  useEffect(() => {
    if ((!isClerkLoaded && !clerkLoadTimedOut) || typeof window === 'undefined')
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
          captureError(
            new Error('Signed-in user missing Convex auth session'),
            {
              operation: 'convexAuthUnavailable',
            }
          );
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
      .catch((error) => {
        if (isStale) return;
        setGuestId(null);
        setGuestToken(null);
        if (isGuestSessionRateLimitError(error)) {
          setAuthError(GUEST_SESSION_RATE_LIMIT_MESSAGE);
        } else {
          captureError(error, { operation: 'fetchGuestSession' });
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
