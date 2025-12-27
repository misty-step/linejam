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
      return {
        guestId: typeof data.guestId === 'string' ? data.guestId : null,
        token: typeof data.token === 'string' ? data.token : null,
      };
    } catch (error) {
      throw new Error(
        `Failed to fetch guest session: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  },
};
