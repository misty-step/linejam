// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  defaultGuestSessionFetcher,
  getGuestToken,
  clearGuestSession,
} from '@/lib/guestSession';

describe('defaultGuestSessionFetcher', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns guestId and token on successful fetch', async () => {
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
});

describe('getGuestToken', () => {
  const STORAGE_KEY = 'linejam_guest_token';

  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when localStorage has no token', () => {
    expect(getGuestToken()).toBeNull();
  });

  it('returns token when localStorage has valid token', () => {
    localStorage.setItem(STORAGE_KEY, 'valid_token_123');
    expect(getGuestToken()).toBe('valid_token_123');
  });

  it('returns null when token is empty string', () => {
    localStorage.setItem(STORAGE_KEY, '');
    expect(getGuestToken()).toBeNull();
  });

  it('returns null when token is whitespace only', () => {
    localStorage.setItem(STORAGE_KEY, '   ');
    expect(getGuestToken()).toBeNull();
  });

  it('trims whitespace from valid token', () => {
    localStorage.setItem(STORAGE_KEY, '  token_with_spaces  ');
    expect(getGuestToken()).toBe('  token_with_spaces  ');
  });
});

describe('clearGuestSession', () => {
  const STORAGE_KEY = 'linejam_guest_token';

  beforeEach(() => {
    localStorage.clear();
  });

  it('removes token from localStorage', () => {
    localStorage.setItem(STORAGE_KEY, 'token_to_clear');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('token_to_clear');

    clearGuestSession();

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('does nothing when no token exists', () => {
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    clearGuestSession();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
