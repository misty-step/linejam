import { useUser as useClerkUser } from '@clerk/nextjs';
import { useCallback, useEffect, useState } from 'react';
import { captureError } from '@/lib/error';
import {
  GuestSessionFetcher,
  defaultGuestSessionFetcher,
} from '@/lib/guestSession';

/**
 * Hook for managing user identity (Clerk or guest).
 *
 * @param fetcher - Injectable fetcher for guest session (default: API fetch).
 *                  Tests can inject a mock to avoid network calls.
 */
export function useUser(
  fetcher: GuestSessionFetcher = defaultGuestSessionFetcher
) {
  const { user: clerkUser, isLoaded: isClerkLoaded } = useClerkUser();
  const [guestId, setGuestId] = useState<string | null>(null);
  const [guestToken, setGuestToken] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!isClerkLoaded || typeof window === 'undefined') return;

    fetcher
      .fetch()
      .then((data) => {
        if (data.guestId) {
          setGuestId(data.guestId);
        }
        if (data.token) {
          setGuestToken(data.token);
        }
        setIsLoaded(true);
      })
      .catch((error) => {
        captureError(error, { operation: 'fetchGuestSession' });
        setAuthError('Unable to connect. Please check your connection.');
        setIsLoaded(true);
      });
  }, [isClerkLoaded, fetcher, retryCount]);

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
