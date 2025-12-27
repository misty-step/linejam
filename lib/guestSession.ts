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
    const res = await fetch('/api/guest/session');
    const data = await res.json();
    return {
      guestId: data.guestId ?? null,
      token: data.token ?? null,
    };
  },
};
