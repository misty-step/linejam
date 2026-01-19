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

const STORAGE_KEY = 'linejam_guest_token';

const persistGuestToken = (token: string | null) => {
  if (typeof window === 'undefined') return;

  if (token) {
    localStorage.setItem(STORAGE_KEY, token);
    return;
  }

  localStorage.removeItem(STORAGE_KEY);
};

export function getGuestToken(): string | null {
  if (typeof window === 'undefined') return null;

  const token = localStorage.getItem(STORAGE_KEY);
  return token && token.trim() ? token : null;
}

export function clearGuestSession() {
  if (typeof window === 'undefined') return;

  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Default fetcher that calls the guest session API.
 * Used in production; tests can inject a mock fetcher.
 */
export const defaultGuestSessionFetcher: GuestSessionFetcher = {
  async fetch(): Promise<GuestSessionData> {
    try {
      const res = await fetch('/api/guest/session');
      if (!res.ok) {
        throw new Error(`Guest session API returned ${res.status}`);
      }
      const data = await res.json();
      const guestId = typeof data.guestId === 'string' ? data.guestId : null;
      const token = typeof data.token === 'string' ? data.token : null;

      persistGuestToken(token);

      return { guestId, token };
    } catch (error) {
      throw new Error(
        `Failed to fetch guest session: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  },
};
