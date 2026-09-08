// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  defaultGuestSessionFetcher,
  clearGuestSession,
  GuestSessionHttpError,
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

  it('removes the legacy token mirror when fetching a session', async () => {
    localStorage.setItem(legacyStorageKey, 'stale-token');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ guestId: 'guest_123', token: 'token_abc' }),
    });

    await defaultGuestSessionFetcher.fetch();
    expect(localStorage.getItem(legacyStorageKey)).toBeNull();
  });

  it('gives concurrent bootstrap callers the same guest identity', async () => {
    let identity = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      identity += 1;
      return Promise.resolve(
        Response.json({
          guestId: `guest_${identity}`,
          token: `token_${identity}`,
        })
      );
    });

    const [navigationSession, roomSession] = await Promise.all([
      defaultGuestSessionFetcher.fetch(),
      defaultGuestSessionFetcher.fetch(),
    ]);

    expect(roomSession).toEqual(navigationSession);
  });

  it('allows a fresh bootstrap after a failed request', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(
        Response.json({ guestId: 'recovered_guest', token: 'recovered_token' })
      );

    await expect(defaultGuestSessionFetcher.fetch()).rejects.toBeInstanceOf(
      Error
    );
    const session = await defaultGuestSessionFetcher.fetch();
    expect(session.guestId).toBe('recovered_guest');
  });

  it('preserves a status-bearing error for guest-session rate limits', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
    });

    const request = defaultGuestSessionFetcher.fetch();

    await expect(request).rejects.toBeInstanceOf(GuestSessionHttpError);
    await expect(request).rejects.toMatchObject({ status: 429 });
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
