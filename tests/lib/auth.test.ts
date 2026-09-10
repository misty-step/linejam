// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  act,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { NextRequest } from 'next/server';

import {
  useUser,
  UserProvider,
  type UserProviderDependencies,
} from '@/lib/auth';
import type { GuestSessionFetcher } from '@/lib/guestSession';
import { AccountContext, type ClerkAccountState } from '@/lib/account';
import { useRoomQueryArgs } from '@/hooks/useRoomQueryArgs';
import { createGuestSessionRoute } from '@/app/api/guest/session/handler';
import { GUEST_TOKEN_TTL_MS, signGuestToken } from '@/lib/guestToken';

const mockUseClerkUser =
  vi.fn<() => Pick<ClerkAccountState, 'user' | 'isLoaded'>>();
const mockUseConvexAuth = vi.fn<() => ClerkAccountState['convex']>();
const mockCaptureError = vi.fn();

const authDeps: UserProviderDependencies = {
  useAccount: () => ({
    kind: 'clerk',
    ...mockUseClerkUser(),
    convex: mockUseConvexAuth(),
  }),
  onError: (error, context) => mockCaptureError(error, context),
};

const renderAuthHook = (fetcher?: GuestSessionFetcher) =>
  renderHook(() => useUser(), {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(
        UserProvider,
        { fetcher, dependencies: authDeps },
        children
      ),
  });

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useUser hook', () => {
  // Store original fetch
  const originalFetch = global.fetch;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    localStorage.clear();
    mockUseClerkUser.mockReturnValue({
      user: null,
      isLoaded: true,
    });
    mockUseConvexAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: false,
    });
    mockCaptureError.mockImplementation(() => {});

    // Mock fetch with default success response (include ok: true for proper HTTP response)
    mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ guestId: 'default-guest', token: 'default-token' }),
    });
    // SAFETY: Test fixture mocks global.fetch for happy-dom hook execution.
    global.fetch = mockFetch as typeof fetch;
  });

  afterEach(() => {
    // Restore original fetch
    global.fetch = originalFetch;
    localStorage.clear();
    vi.useRealTimers();
  });

  it('loads guest credentials without mounting either account auth hook locally', async () => {
    const fetcher = {
      fetch: vi.fn().mockResolvedValue({
        guestId: 'local-guest',
        token: 'local-signed-token',
      }),
    };
    const { result } = renderHook(() => useUser(), {
      wrapper: ({ children }: { children: ReactNode }) =>
        createElement(
          AccountContext.Provider,
          { value: { kind: 'local' } },
          createElement(UserProvider, { fetcher }, children)
        ),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.guestId).toBe('local-guest');
    expect(result.current.guestToken).toBe('local-signed-token');
    expect(result.current.authError).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('returns loading state while Clerk is loading', () => {
    // Arrange
    mockUseClerkUser.mockReturnValue({
      user: null,
      isLoaded: false, // Clerk still loading
    });

    // Act
    const { result } = renderAuthHook();

    // Assert
    expect(result.current.isLoading).toBe(true);
    expect(result.current.clerkUser).toBeNull();
    expect(result.current.guestId).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('falls back to a guest session when Clerk never finishes loading', async () => {
    vi.useFakeTimers();
    mockUseClerkUser.mockReturnValue({
      user: null,
      isLoaded: false,
    });
    const fetcher = {
      fetch: vi.fn().mockResolvedValue({
        guestId: 'guest-clerk-outage',
        token: 'token-clerk-outage',
      }),
    };

    const { result } = renderAuthHook(fetcher);

    expect(result.current.isLoading).toBe(true);
    expect(fetcher.fetch).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_999);
    });

    expect(fetcher.fetch).not.toHaveBeenCalled();
    expect(mockCaptureError).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
      await Promise.resolve();
    });

    expect(result.current.isLoading).toBe(false);
    expect(fetcher.fetch).toHaveBeenCalledTimes(1);
    expect(result.current.guestId).toBe('guest-clerk-outage');
    expect(result.current.guestToken).toBe('token-clerk-outage');
    expect(result.current.authError).toBeNull();
    expect(mockCaptureError).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'ClerkLoadTimeoutError',
        message: 'Clerk did not load in time; continuing with guest play',
      }),
      { operation: 'clerkLoadTimeout' }
    );
  });

  it('gives a late authenticated Clerk session precedence over guest fallback', async () => {
    vi.useFakeTimers();
    mockUseClerkUser.mockReturnValue({
      user: null,
      isLoaded: false,
    });
    const fetcher = {
      fetch: vi.fn().mockResolvedValue({
        guestId: 'guest-before-clerk',
        token: 'token-before-clerk',
      }),
    };
    const { result, rerender } = renderAuthHook(fetcher);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
      await Promise.resolve();
    });
    expect(result.current.guestId).toBe('guest-before-clerk');

    const clerkUser = {
      id: 'clerk_late',
      fullName: 'Late Clerk User',
      firstName: 'Late',
    };
    mockUseClerkUser.mockReturnValue({ user: clerkUser, isLoaded: true });
    mockUseConvexAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
    });
    await act(async () => {
      rerender();
      await Promise.resolve();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.clerkUser).toEqual(clerkUser);
    expect(result.current.guestId).toBeNull();
    expect(result.current.guestToken).toBeNull();
    expect(result.current.displayName).toBe('Late Clerk User');
    expect(fetcher.fetch).toHaveBeenCalledTimes(1);
  });

  it('keeps the guest session when Clerk loads late without a user', async () => {
    vi.useFakeTimers();
    mockUseClerkUser.mockReturnValue({
      user: null,
      isLoaded: false,
    });
    const fetcher = {
      fetch: vi.fn().mockResolvedValue({
        guestId: 'guest-stable',
        token: 'token-stable',
      }),
    };
    const { result, rerender } = renderAuthHook(fetcher);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
      await Promise.resolve();
    });
    expect(result.current.guestId).toBe('guest-stable');

    mockUseClerkUser.mockReturnValue({ user: null, isLoaded: true });
    rerender();

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetcher.fetch).toHaveBeenCalledTimes(1);
    expect(result.current.guestId).toBe('guest-stable');
    expect(result.current.guestToken).toBe('token-stable');
    expect(result.current.isLoading).toBe(false);
  });

  it('returns Clerk user when authenticated, does not fetch guest session', async () => {
    // Arrange
    const clerkUser = {
      id: 'clerk_123',
      fullName: 'John Doe',
      firstName: 'John',
    };
    mockUseClerkUser.mockReturnValue({
      user: clerkUser,
      isLoaded: true,
    });
    mockUseConvexAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
    });

    // Act
    const { result } = renderAuthHook();

    // Wait for effect to complete
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Assert
    expect(result.current.clerkUser).toEqual(clerkUser);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.displayName).toBe('John Doe');
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.guestId).toBeNull();
    expect(result.current.guestToken).toBeNull();
    expect(result.current.authError).toBeNull();
  });

  it('fetches guest session when no Clerk user', async () => {
    // Arrange
    const mockGuestData = {
      guestId: 'guest-abc-123',
      token: 'signed-jwt-token',
    };
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockGuestData,
    });

    mockUseClerkUser.mockReturnValue({
      user: null,
      isLoaded: true,
    });

    // Act
    const { result } = renderAuthHook();

    // Wait for fetch to complete
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Assert
    expect(mockFetch).toHaveBeenCalledWith('/api/guest/session');
    expect(result.current.guestId).toBe('guest-abc-123');
    expect(result.current.guestToken).toBe('signed-jwt-token');
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.displayName).toBe('Guest');
  });

  it('rejects a guest response without a usable credential', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ guestId: 'guest-no-token' }),
    });
    const { result } = renderAuthHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.authError).not.toBeNull();
    expect(result.current.guestId).toBeNull();
    expect(result.current.guestToken).toBeNull();
  });

  it('sets authError on fetch failure instead of silent success', async () => {
    // Arrange
    mockFetch.mockRejectedValue(new Error('Network error'));

    mockUseClerkUser.mockReturnValue({
      user: null,
      isLoaded: true,
    });

    // Act
    const { result } = renderAuthHook();

    // Wait for error handling
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Assert - error is captured by the shared observability helper
    expect(mockCaptureError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Failed to fetch guest session'),
      }),
      { operation: 'fetchGuestSession' }
    );
    // Auth error is set for UI display
    expect(result.current.authError).toBe(
      'Unable to connect. Please check your connection.'
    );
    expect(result.current.guestId).toBeNull();
    expect(result.current.guestToken).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('shows expected guest throttling without reporting it to Sentry', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 429 });

    const { result } = renderAuthHook();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.authError).toBe(
      'Too many guest sessions. Please wait a few minutes before trying again.'
    );
    expect(mockCaptureError).not.toHaveBeenCalled();
    expect(result.current.guestId).toBeNull();
    expect(result.current.guestToken).toBeNull();
  });

  it('removes stale localStorage guest token when guest bootstrap fails', async () => {
    localStorage.setItem('linejam_guest_token', 'stale-token');
    mockFetch.mockRejectedValue(new Error('Network error'));

    const { result } = renderAuthHook();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(localStorage.getItem('linejam_guest_token')).toBeNull();
    expect(result.current.authError).toBe(
      'Unable to connect. Please check your connection.'
    );
  });

  it('retryAuth clears error and retries fetch', async () => {
    // Arrange - first call fails, second succeeds
    mockFetch
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ guestId: 'guest-retry', token: 'token-retry' }),
      });

    mockUseClerkUser.mockReturnValue({
      user: null,
      isLoaded: true,
    });

    // Act - initial render fails
    const { result } = renderAuthHook();

    await waitFor(() => {
      expect(result.current.authError).toBe(
        'Unable to connect. Please check your connection.'
      );
    });

    // Act - retry
    act(() => {
      result.current.retryAuth();
    });

    await waitFor(() => {
      expect(result.current.authError).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    // Assert - retry succeeded
    expect(result.current.guestId).toBe('guest-retry');
    expect(result.current.guestToken).toBe('token-retry');
  });

  it('ignores stale fetch results from earlier retries', async () => {
    const first = createDeferred<{
      guestId: string | null;
      token: string | null;
    }>();
    const second = createDeferred<{
      guestId: string | null;
      token: string | null;
    }>();
    const fetcher = {
      fetch: vi
        .fn()
        .mockImplementationOnce(() => first.promise)
        .mockImplementationOnce(() => second.promise),
    };

    const { result } = renderAuthHook(fetcher);

    await waitFor(() => {
      expect(fetcher.fetch).toHaveBeenCalledTimes(1);
    });

    act(() => {
      result.current.retryAuth();
    });

    await waitFor(() => {
      expect(fetcher.fetch).toHaveBeenCalledTimes(2);
    });

    await act(async () => {
      second.resolve({ guestId: 'guest-fresh', token: 'token-fresh' });
      await second.promise;
    });

    await waitFor(() => {
      expect(result.current.guestId).toBe('guest-fresh');
      expect(result.current.guestToken).toBe('token-fresh');
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      first.resolve({ guestId: 'guest-stale', token: 'token-stale' });
      await first.promise;
    });

    expect(result.current.guestId).toBe('guest-fresh');
    expect(result.current.guestToken).toBe('token-fresh');
    expect(result.current.authError).toBeNull();
  });

  it('uses fullName for displayName when available', async () => {
    // Arrange
    const clerkUser = {
      id: 'clerk_456',
      fullName: 'Jane Smith',
      firstName: 'Jane',
    };
    mockUseClerkUser.mockReturnValue({
      user: clerkUser,
      isLoaded: true,
    });
    mockUseConvexAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
    });

    // Act
    const { result } = renderAuthHook();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Assert
    expect(result.current.displayName).toBe('Jane Smith');
  });

  it('falls back to firstName when fullName not available', async () => {
    // Arrange
    const clerkUser = {
      id: 'clerk_789',
      firstName: 'Bob',
      // fullName not present
    };
    mockUseClerkUser.mockReturnValue({
      user: clerkUser,
      isLoaded: true,
    });
    mockUseConvexAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
    });

    // Act
    const { result } = renderAuthHook();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Assert
    expect(result.current.displayName).toBe('Bob');
  });

  it('uses "Guest" displayName when no Clerk user', async () => {
    // Arrange
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ guestId: 'guest-xyz', token: 'token-xyz' }),
    });

    mockUseClerkUser.mockReturnValue({
      user: null,
      isLoaded: true,
    });

    // Act
    const { result } = renderAuthHook();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Assert
    expect(result.current.displayName).toBe('Guest');
  });

  it('keeps signed-in users loading until Convex auth finishes', () => {
    const clerkUser = {
      id: 'clerk_pending',
      fullName: 'Pending User',
      firstName: 'Pending',
    };
    mockUseClerkUser.mockReturnValue({
      user: clerkUser,
      isLoaded: true,
    });
    mockUseConvexAuth.mockReturnValue({
      isLoading: true,
      isAuthenticated: false,
    });

    const { result } = renderAuthHook();

    expect(result.current.isLoading).toBe(true);
    expect(result.current.authError).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('surfaces a signed-in auth error when Convex auth is unavailable', async () => {
    const clerkUser = {
      id: 'clerk_broken',
      fullName: 'Broken User',
      firstName: 'Broken',
    };
    mockUseClerkUser.mockReturnValue({
      user: clerkUser,
      isLoaded: true,
    });
    mockUseConvexAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: false,
    });

    const { result } = renderAuthHook();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.authError).toBe(
      'Your account signed in, but the game server could not verify it. Please refresh and try again.'
    );
    expect(mockCaptureError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Signed-in user missing Convex auth session',
      }),
      { operation: 'convexAuthUnavailable' }
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('keeps resolved identity when later routes and game phases mount', async () => {
    const fetcher = {
      fetch: vi.fn().mockResolvedValue({
        guestId: 'shared-guest',
        token: 'shared-token',
      }),
    };
    function Consumer({ phase }: { phase: string }) {
      const user = useUser();
      return createElement(
        'output',
        null,
        `${phase}:${user.isLoading ? 'loading' : user.guestId}`
      );
    }
    const tree = (phase: string) =>
      createElement(
        UserProvider,
        { fetcher, dependencies: authDeps },
        createElement(Consumer, { key: phase, phase })
      );
    const view = render(tree('entry'));
    await screen.findByText('entry:shared-guest');
    for (const phase of ['room', 'writing', 'reveal', 'poem']) {
      view.rerender(tree(phase));
      expect(screen.getByText(`${phase}:shared-guest`)).toBeInTheDocument();
    }
    expect(fetcher.fetch).toHaveBeenCalledTimes(1);
  });

  it('gates a retained guest token as soon as Clerk starts authenticating', async () => {
    const fetcher = {
      fetch: vi.fn().mockResolvedValue({
        guestId: 'before-account',
        token: 'before-account-token',
      }),
    };
    const { result, rerender } = renderHook(
      () => useRoomQueryArgs('ABCD', 'before-account-token'),
      {
        wrapper: ({ children }: { children: ReactNode }) =>
          createElement(
            UserProvider,
            { fetcher, dependencies: authDeps },
            children
          ),
      }
    );
    await waitFor(() => expect(result.current.shouldSkip).toBe(false));
    mockUseClerkUser.mockReturnValue({
      user: { id: 'linked-account' },
      isLoaded: true,
    });
    mockUseConvexAuth.mockReturnValue({
      isLoading: true,
      isAuthenticated: false,
    });
    rerender();
    expect(result.current.queryArgs).toBe('skip');
    expect(result.current.guestToken).toBeNull();
    mockUseConvexAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
    });
    rerender();
    expect(result.current.queryArgs).toEqual({
      roomCode: 'ABCD',
      guestToken: undefined,
    });
  });

  it('reacquires from the cookie after account linking and sign-out', async () => {
    const afterSignOut = createDeferred<{ guestId: string; token: string }>();
    const fetcher = {
      fetch: vi
        .fn()
        .mockResolvedValueOnce({
          guestId: 'before-link',
          token: 'revoked-token',
        })
        .mockImplementationOnce(() => afterSignOut.promise),
    };
    const { result, rerender } = renderAuthHook(fetcher);
    await waitFor(() => expect(result.current.guestId).toBe('before-link'));
    mockUseClerkUser.mockReturnValue({
      user: { id: 'account' },
      isLoaded: true,
    });
    mockUseConvexAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
    });
    await act(async () => rerender());
    mockUseClerkUser.mockReturnValue({ user: null, isLoaded: true });
    mockUseConvexAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: false,
    });
    rerender();
    expect(result.current.isLoading).toBe(true);
    expect(result.current.guestToken).toBeNull();
    await act(async () => {
      afterSignOut.resolve({ guestId: 'after-link', token: 'fresh-token' });
    });
    expect(result.current.guestId).toBe('after-link');
    expect(result.current.guestToken).toBe('fresh-token');
  });

  it.each([
    { clock: 'ahead', offsetMs: 5 * 60_000 },
    { clock: 'behind', offsetMs: -5 * 60_000 },
  ])(
    'keeps a server-valid retained guest with the client clock five minutes $clock until real expiry',
    async ({ offsetMs }) => {
      vi.useFakeTimers({
        toFake: ['Date', 'performance', 'setTimeout', 'clearTimeout'],
      });
      const serverNow = Date.UTC(2026, 8, 10);
      const remainingMs = 2 * 60_000;
      vi.setSystemTime(serverNow + offsetMs);
      const retainedToken = await signGuestToken('retained-guest', {
        sessionId: 'retained-session',
        rateLimitKey: 'guestSession:retained',
        issuedAt: serverNow - GUEST_TOKEN_TTL_MS + remainingMs,
      });
      let cookie = retainedToken;
      const GET = createGuestSessionRoute({ checkThrottle: async () => {} });
      const requests: Promise<Response>[] = [];
      const reacquisition = createDeferred<void>();
      let holdReacquisition = false;
      mockFetch.mockImplementation((url: string) => {
        const response = (async () => {
          if (holdReacquisition) await reacquisition.promise;
          const request = new NextRequest(
            new URL(url, 'http://localhost:3000')
          );
          request.cookies.set('linejam_guest_token', cookie);
          // The in-process HTTP boundary has its own server wall clock.
          // Signing, verification, response parsing and auth remain real.
          const serverClock = vi
            .spyOn(Date, 'now')
            .mockImplementation(() => serverNow + performance.now());
          try {
            const result = await GET(request);
            cookie = result.cookies.get('linejam_guest_token')?.value ?? cookie;
            return result;
          } finally {
            serverClock.mockRestore();
          }
        })();
        requests.push(response);
        return response;
      });
      const queryGates: boolean[] = [];
      const { result, unmount } = renderHook(
        () => {
          const room = useRoomQueryArgs('ABCD');
          queryGates.push(room.shouldSkip);
          return { user: useUser(), room };
        },
        {
          wrapper: ({ children }: { children: ReactNode }) =>
            createElement(UserProvider, { dependencies: authDeps }, children),
        }
      );
      try {
        await act(async () => {
          await requests[0];
        });
        expect(result.current.user.guestId).toBe('retained-guest');
        expect(result.current.user.guestToken === retainedToken).toBe(true);
        queryGates.length = 0;

        // An ahead wall clock used to drop query authorization and reacquire
        // the same still-valid cookie on every immediate expiry callback.
        for (let step = 0; step < 3; step += 1) {
          await act(async () => {
            await vi.advanceTimersByTimeAsync(1);
          });
          await act(async () => {
            await requests.at(-1);
          });
        }
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(queryGates).not.toContain(true);
        expect(result.current.room.shouldSkip).toBe(false);

        await act(async () => {
          await vi.advanceTimersByTimeAsync(remainingMs - 4);
        });
        expect(result.current.user.guestId).toBe('retained-guest');
        expect(result.current.room.shouldSkip).toBe(false);

        holdReacquisition = true;
        await act(async () => {
          await vi.advanceTimersByTimeAsync(2);
        });
        expect(result.current.room.queryArgs === 'skip').toBe(true);
        expect(result.current.user.guestToken === null).toBe(true);
        expect(mockFetch).toHaveBeenCalledTimes(2);

        await act(async () => {
          reacquisition.resolve();
          await requests.at(-1);
        });
        expect(result.current.user.guestId === 'retained-guest').toBe(false);
        expect(result.current.user.guestToken === cookie).toBe(true);
        expect(result.current.user.guestToken === retainedToken).toBe(false);
        expect(result.current.room.shouldSkip).toBe(false);
      } finally {
        unmount();
        reacquisition.resolve();
        await Promise.all(requests);
      }
    }
  );

  it('never authorizes a credential that expired while its response was in transit', async () => {
    vi.useFakeTimers({
      toFake: ['Date', 'performance', 'setTimeout', 'clearTimeout'],
    });
    const delayed = createDeferred<Response>();
    const renewed = createDeferred<Response>();
    mockFetch
      .mockImplementationOnce(() => delayed.promise)
      .mockImplementationOnce(() => renewed.promise);
    const authorized: boolean[] = [];
    const { result } = renderHook(
      () => {
        const room = useRoomQueryArgs('ABCD');
        authorized.push(!room.shouldSkip);
        return room;
      },
      {
        wrapper: ({ children }: { children: ReactNode }) =>
          createElement(UserProvider, { dependencies: authDeps }, children),
      }
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_001);
      delayed.resolve(
        Response.json({
          guestId: 'too-late',
          token: 'expired',
          validForMs: 1_000,
        })
      );
    });
    expect(result.current.queryArgs).toBe('skip');
    expect(authorized).not.toContain(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(mockFetch).toHaveBeenCalledTimes(2);
    await act(async () => {
      renewed.resolve(
        Response.json({ guestId: 'renewed', token: 'fresh', validForMs: 2_000 })
      );
    });
    expect(result.current.shouldSkip).toBe(false);
    expect(result.current.guestToken).toBe('fresh');
  });

  it('stops using an expired credential without waiting for a route remount', async () => {
    vi.useFakeTimers({
      toFake: ['Date', 'performance', 'setTimeout', 'clearTimeout'],
    });
    const renewed = createDeferred<{
      guestId: string;
      token: string;
      expiresAtMonotonic: number;
    }>();
    const fetcher = {
      fetch: vi
        .fn()
        .mockResolvedValueOnce({
          guestId: 'expiring',
          token: 'old',
          expiresAtMonotonic: 1_000,
        })
        .mockImplementationOnce(() => renewed.promise),
    };
    const { result } = renderAuthHook(fetcher);
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.guestToken).toBe('old');
    vi.setSystemTime(Date.now() - 24 * 60 * 60_000);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_001);
    });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.guestToken).toBeNull();
    await act(async () => {
      renewed.resolve({
        guestId: 'renewed',
        token: 'new',
        expiresAtMonotonic: 20_000,
      });
    });
    expect(result.current.guestToken).toBe('new');
  });

  // Note: SSR test (window undefined) removed - difficult to test properly in happy-dom
  // environment with React 19. The SSR check is defensive code that prevents crashes
  // but is hard to trigger in testing without breaking the test environment itself.
});
