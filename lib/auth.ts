import { useUser as useClerkUser } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
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

  useEffect(() => {
    // Wait for Clerk to load first
    if (!isClerkLoaded || typeof window === 'undefined') return;

    // Fetch guest session via injectable fetcher
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
        // Client-side error - Sentry will capture, no need for server logger
        setIsLoaded(true);
      });
  }, [isClerkLoaded, fetcher]);

  const isLoading = !isLoaded;

  // If clerkUser is present, we use that.
  // If not, we use guestId from server-signed token.
  // We always return guestId because we might need it for "ensureUser" if the user is not logged in.

  return {
    clerkUser,
    guestId,
    guestToken,
    isLoading,
    isAuthenticated: !!clerkUser,
    displayName: clerkUser?.fullName || clerkUser?.firstName || 'Guest',
  };
}
