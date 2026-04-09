// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

// Mock Clerk
const mockUseClerkUser = vi.fn();
vi.mock('@clerk/nextjs', () => ({
  useUser: () => mockUseClerkUser(),
}));

const mockUseConvexAuth = vi.fn();
vi.mock('convex/react', () => ({
  useConvexAuth: () => mockUseConvexAuth(),
}));

// Mock captureError
const mockCaptureError = vi.fn();
vi.mock('@/lib/error', () => ({
  captureError: (...args: unknown[]) => mockCaptureError(...args),
}));

// Import after mocking
import { useUser } from '@/lib/auth';

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
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
    global.fetch = mockFetch as typeof fetch;
  });

  afterEach(() => {
    // Restore original fetch
    global.fetch = originalFetch;
    localStorage.clear();
  });

  it('returns loading state while Clerk is loading', () => {
    // Arrange
    mockUseClerkUser.mockReturnValue({
      user: null,
      isLoaded: false, // Clerk still loading
    });

    // Act
    const { result } = renderHook(() => useUser());

    // Assert
    expect(result.current.isLoading).toBe(true);
    expect(result.current.clerkUser).toBeNull();
    expect(result.current.guestId).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
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
    const { result } = renderHook(() => useUser());

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
    const { result } = renderHook(() => useUser());

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

  it('handles API response with guestId but no token', async () => {
    // Arrange - API returns guestId only, no token
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ guestId: 'guest-no-token' }),
    });

    mockUseClerkUser.mockReturnValue({
      user: null,
      isLoaded: true,
    });

    // Act
    const { result } = renderHook(() => useUser());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Assert
    expect(result.current.guestId).toBe('guest-no-token');
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
    const { result } = renderHook(() => useUser());

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

  it('preserves existing guest token in localStorage when guest bootstrap fails', async () => {
    localStorage.setItem('linejam_guest_token', 'stale-token');
    mockFetch.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useUser());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(localStorage.getItem('linejam_guest_token')).toBe('stale-token');
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
    const { result } = renderHook(() => useUser());

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

    const { result } = renderHook(() => useUser(fetcher));

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
    const { result } = renderHook(() => useUser());

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
    const { result } = renderHook(() => useUser());

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
    const { result } = renderHook(() => useUser());

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

    const { result } = renderHook(() => useUser());

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

    const { result } = renderHook(() => useUser());

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

  // Note: SSR test (window undefined) removed - difficult to test properly in happy-dom
  // environment with React 19. The SSR check is defensive code that prevents crashes
  // but is hard to trigger in testing without breaking the test environment itself.
});
