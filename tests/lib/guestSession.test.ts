// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  defaultGuestSessionFetcher,
  getExistingGuestSession,
  clearGuestSession,
} from '@/lib/guestSession';

describe('defaultGuestSessionFetcher', () => {
  const originalFetch = global.fetch;
  const legacyStorageKey = 'linejam_guest_token';

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    localStorage.clear();
  });

  it('returns guestId and token on successful fetch', async () => {
    localStorage.setItem(legacyStorageKey, 'stale-token');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ guestId: 'guest_123', token: 'token_abc' }),
    });

    const result = await defaultGuestSessionFetcher.fetch();

    expect(result).toEqual({
      guestId: 'guest_123',
      token: 'token_abc',
    });
    expect(global.fetch).toHaveBeenCalledWith('/api/guest/session');
    expect(localStorage.getItem(legacyStorageKey)).toBeNull();
  });

  it('throws error when API returns non-ok status', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });

    await expect(defaultGuestSessionFetcher.fetch()).rejects.toThrow(
      'Failed to fetch guest session: Guest session API returned 500'
    );
  });

  it('returns null for non-string guestId', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ guestId: 12345, token: 'valid_token' }),
    });

    const result = await defaultGuestSessionFetcher.fetch();

    expect(result.guestId).toBeNull();
    expect(result.token).toBe('valid_token');
  });

  it('returns null for non-string token', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ guestId: 'guest_123', token: null }),
    });

    const result = await defaultGuestSessionFetcher.fetch();

    expect(result.guestId).toBe('guest_123');
    expect(result.token).toBeNull();
  });

  it('throws error when fetch fails (network error)', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    await expect(defaultGuestSessionFetcher.fetch()).rejects.toThrow(
      'Failed to fetch guest session: Network error'
    );
  });

  it('handles unknown error types in catch block', async () => {
    global.fetch = vi.fn().mockRejectedValue('string error');

    await expect(defaultGuestSessionFetcher.fetch()).rejects.toThrow(
      'Failed to fetch guest session: Unknown error'
    );
  });
  it('reads an existing session without minting a new one', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ guestId: 'guest_existing', token: 'token_existing' }),
    });

    const result = await getExistingGuestSession();

    expect(result).toEqual({
      guestId: 'guest_existing',
      token: 'token_existing',
    });
    expect(global.fetch).toHaveBeenCalledWith('/api/guest/session?existing=1');
  });
});

describe('clearGuestSession', () => {
  const originalFetch = global.fetch;
  const legacyStorageKey = 'linejam_guest_token';

  beforeEach(() => {
    localStorage.clear();
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('removes legacy localStorage token and revokes the cookie carrier', async () => {
    localStorage.setItem(legacyStorageKey, 'token_to_clear');
    expect(localStorage.getItem(legacyStorageKey)).toBe('token_to_clear');

    await clearGuestSession();

    expect(localStorage.getItem(legacyStorageKey)).toBeNull();
    expect(global.fetch).toHaveBeenCalledWith('/api/guest/session', {
      method: 'DELETE',
    });
  });

  it('throws when revocation fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });

    await expect(clearGuestSession()).rejects.toThrow(
      'Guest session revocation returned 503'
    );
  });
});
