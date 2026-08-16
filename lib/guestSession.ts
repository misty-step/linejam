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
  cause: unknown
): cause is GuestSessionHttpError {
  return cause instanceof GuestSessionHttpError && cause.status === 429;
}

const LEGACY_STORAGE_KEY = 'linejam_guest_token';

const clearLegacyGuestTokenMirror = () => {
  if (globalThis.window === undefined) return;

  localStorage.removeItem(LEGACY_STORAGE_KEY);
};

export async function clearGuestSession() {
  if (globalThis.window === undefined) return;

  clearLegacyGuestTokenMirror();
  const res = await fetch('/api/guest/session', { method: 'DELETE' });
  if (!res.ok) {
    throw new Error(`Guest session revocation returned ${res.status}`);
  }
}

export async function getExistingGuestSession(): Promise<GuestSessionData> {
  return fetchGuestSession('/api/guest/session?existing=1');
}

type GuestSessionWireValue =
  | string
  | number
  | boolean
  | null
  | GuestSessionWireValue[]
  | GuestSessionWireObject;

interface GuestSessionWireObject {
  [key: string]: GuestSessionWireValue;
}

interface GuestSessionApiResponse {
  guestId?: GuestSessionWireValue;
  token?: GuestSessionWireValue;
}

async function fetchGuestSession(url: string): Promise<GuestSessionData> {
  clearLegacyGuestTokenMirror();

  const res = await fetch(url);
  if (!res.ok) {
    throw new GuestSessionHttpError(res.status);
  }
  const data: GuestSessionApiResponse = await res.json();
  const guestId =
    data instanceof Object && 'guestId' in data
      ? parseGuestSessionString(data.guestId)
      : null;
  const token =
    data instanceof Object && 'token' in data
      ? parseGuestSessionString(data.token)
      : null;

  return { guestId, token };
}

function parseGuestSessionString(
  value: GuestSessionWireValue | undefined
): string | null {
  try {
    return String.prototype.valueOf.call(value);
  } catch {
    return null;
  }
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
