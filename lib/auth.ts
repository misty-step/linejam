'use client';

import {
  useAccountState,
  type AccountState,
  type ClerkAccountState,
} from '@/lib/account';
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { captureError } from '@/lib/error';
import {
  toErrorReportable,
  type ErrorReportable,
  type ErrorReportContext,
} from '@/lib/errorCore';
import {
  GUEST_SESSION_RATE_LIMIT_MESSAGE,
  type GuestSessionData,
  type GuestSessionFetcher,
  defaultGuestSessionFetcher,
  isGuestSessionRateLimitError,
} from '@/lib/guestSession';

const CLERK_GUEST_FALLBACK_MS = 5_000;
const CONVEX_AUTH_ERROR =
  'Your account signed in, but the game server could not verify it. Please refresh and try again.';

export type UserProviderDependencies = {
  useAccount?: () => AccountState;
  onError?: (error: ErrorReportable, context?: ErrorReportContext) => void;
};

type GuestState = {
  session: GuestSessionData | null;
  error: string | null;
  expired: boolean;
};

export interface UserState {
  clerkUser: ClerkAccountState['user'];
  guestId: string | null;
  guestToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  displayName: string;
  authError: string | null;
  retryAuth(): void;
}

const UserContext = createContext<UserState | null>(null);

/** One bootstrap owner survives route and phase changes; consumers never acquire identity. */
export function UserProvider({
  children,
  fetcher = defaultGuestSessionFetcher,
  dependencies,
}: {
  children?: ReactNode;
  fetcher?: GuestSessionFetcher;
  dependencies?: UserProviderDependencies;
}) {
  const user = useUserSession(fetcher, dependencies);
  return createElement(UserContext.Provider, { value: user }, children);
}

export function useUser() {
  const user = useContext(UserContext);
  if (!user) throw new Error('UserProvider is required');
  return user;
}

function useUserSession(
  fetcher: GuestSessionFetcher,
  dependencies?: UserProviderDependencies
) {
  const useAccount = dependencies?.useAccount ?? useAccountState;
  const account = useAccount();
  const clerkUser = account.kind === 'clerk' ? account.user : null;
  const clerkUserId = clerkUser?.id;
  const isClerkLoaded = account.kind === 'local' || account.isLoaded;
  const isConvexAuthLoading =
    account.kind === 'clerk' && account.convex.isLoading;
  const isConvexAuthenticated =
    account.kind === 'clerk' && account.convex.isAuthenticated;
  const reportError = dependencies?.onError ?? captureError;
  const [guest, setGuest] = useState<GuestState | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [clerkLoadTimedOut, setClerkLoadTimedOut] = useState(false);
  const canLoadGuest = !clerkUserId && (isClerkLoaded || clerkLoadTimedOut);

  useEffect(() => {
    if (isClerkLoaded || globalThis.window === undefined) return;
    const timeout = window.setTimeout(() => {
      const error = new Error(
        'Clerk did not load in time; continuing with guest play'
      );
      error.name = 'ClerkLoadTimeoutError';
      setClerkLoadTimedOut(true);
      reportError(error, { operation: 'clerkLoadTimeout' });
    }, CLERK_GUEST_FALLBACK_MS);
    return () => window.clearTimeout(timeout);
  }, [isClerkLoaded, reportError]);

  useEffect(() => {
    if (globalThis.window === undefined) return;
    let isStale = false;
    if (clerkUserId) {
      // Linking can revoke the cookie. A subsequent sign-out must acquire from
      // that authority again, never resurrect this provider's previous guest.
      queueMicrotask(() => {
        if (!isStale) setGuest(null);
      });
    } else if (canLoadGuest) {
      void fetcher
        .fetch()
        .then((session) => {
          if (!session.guestId || !session.token) {
            throw new Error('Guest session is missing verified credentials');
          }
          if (isStale) return;
          // Check the monotonic clock at the async boundary, never during render.
          // An already-expired response stays fenced until the renewal timer runs.
          const expired =
            session.expiresAtMonotonic !== undefined &&
            performance.now() > session.expiresAtMonotonic;
          setGuest({ session, error: null, expired });
        })
        .catch((cause) => {
          if (isStale) return;
          const error = toErrorReportable(cause);
          if (!isGuestSessionRateLimitError(error)) {
            reportError(error, { operation: 'fetchGuestSession' });
          }
          setGuest({
            session: null,
            expired: false,
            error: isGuestSessionRateLimitError(error)
              ? GUEST_SESSION_RATE_LIMIT_MESSAGE
              : 'Unable to connect. Please check your connection.',
          });
        });
    }
    return () => {
      isStale = true;
    };
  }, [canLoadGuest, clerkUserId, fetcher, retryCount, reportError]);

  const retryAuth = useCallback(() => {
    setGuest(null);
    setRetryCount((count) => count + 1);
  }, []);

  const expiresAtMonotonic = guest?.session?.expiresAtMonotonic;
  useEffect(() => {
    if (!canLoadGuest || expiresAtMonotonic === undefined) return;
    // The fetcher already charged network time against server-relative validity.
    const timeout = window.setTimeout(
      retryAuth,
      Math.max(0, expiresAtMonotonic - performance.now() + 1)
    );
    return () => window.clearTimeout(timeout);
  }, [canLoadGuest, expiresAtMonotonic, retryAuth]);

  const accountError =
    clerkUser && isClerkLoaded && !isConvexAuthLoading && !isConvexAuthenticated
      ? CONVEX_AUTH_ERROR
      : null;
  useEffect(() => {
    if (accountError) {
      reportError(new Error('Signed-in user missing Convex auth session'), {
        operation: 'convexAuthUnavailable',
      });
    }
  }, [accountError, clerkUserId, reportError]);

  // Fence guest proof synchronously when Clerk arrives. Effects must never leave
  // a render where a signed-in account can issue a query as its previous guest.
  const guestExpired = guest?.expired ?? false;
  const session = clerkUser || guestExpired ? null : guest?.session;
  const guestId = session?.guestId ?? null;
  const guestToken = session?.token ?? null;
  const isLoading = clerkUser
    ? !isClerkLoaded || isConvexAuthLoading
    : !canLoadGuest || guest === null || guestExpired;
  const authError = clerkUser ? accountError : (guest?.error ?? null);

  return useMemo(
    () => ({
      clerkUser,
      guestId,
      guestToken,
      isLoading,
      isAuthenticated: !!clerkUser,
      displayName: clerkUser?.fullName || clerkUser?.firstName || 'Guest',
      authError,
      retryAuth,
    }),
    [clerkUser, guestId, guestToken, isLoading, authError, retryAuth]
  );
}
