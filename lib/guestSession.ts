/**
 * Guest Session Fetcher
 *
 * Deep module for fetching guest session data from the API.
 * Simple interface (one method), complex implementation hidden.
 *
 * Ousterhout principle: Callers don't need to know about API structure,
 * error handling, or response parsing.
 */

export interface GuestSessionData {
  guestId: string | null;
  token: string | null;
}

export interface GuestSessionFetcher {
  fetch(): Promise<GuestSessionData>;
}

export const GUEST_SESSION_RATE_LIMIT_MESSAGE =
  'Too many guest sessions. Please wait a few minutes before trying again.';

export class GuestSessionHttpError extends Error {
  constructor(readonly status: number) {
    super(`Guest session API returned ${status}`);
    this.name = 'GuestSessionHttpError';
  }
}

export function isGuestSessionRateLimitError(
  error: unknown
): error is GuestSessionHttpError {
  return error instanceof GuestSessionHttpError && error.status === 429;
}

const LEGACY_STORAGE_KEY = 'linejam_guest_token';

const clearLegacyGuestTokenMirror = () => {
  if (typeof window === 'undefined') return;

  localStorage.removeItem(LEGACY_STORAGE_KEY);
};

export async function clearGuestSession() {
  if (typeof window === 'undefined') return;

  clearLegacyGuestTokenMirror();
  const res = await fetch('/api/guest/session', { method: 'DELETE' });
  if (!res.ok) {
    throw new Error(`Guest session revocation returned ${res.status}`);
  }
}

export async function getExistingGuestSession(): Promise<GuestSessionData> {
  return fetchGuestSession('/api/guest/session?existing=1');
}

async function fetchGuestSession(url: string): Promise<GuestSessionData> {
  clearLegacyGuestTokenMirror();

  const res = await fetch(url);
  if (!res.ok) {
    throw new GuestSessionHttpError(res.status);
  }
  const data = await res.json();
  const guestId = typeof data.guestId === 'string' ? data.guestId : null;
  const token = typeof data.token === 'string' ? data.token : null;

  return { guestId, token };
}

/**
 * Default fetcher that calls the guest session API.
 * Used in production; tests can inject a mock fetcher.
 */
export const defaultGuestSessionFetcher: GuestSessionFetcher = {
  async fetch(): Promise<GuestSessionData> {
    try {
      return await fetchGuestSession('/api/guest/session');
    } catch (error) {
      if (isGuestSessionRateLimitError(error)) throw error;

      throw new Error(
        `Failed to fetch guest session: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  },
};
