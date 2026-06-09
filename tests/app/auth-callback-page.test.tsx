// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockReplace = vi.fn();
const mockUseClerkUser = vi.fn();
const mockUseConvexAuth = vi.fn();
const mockUseMutation = vi.fn();
const mockMigrateGuestToUser = vi.fn();
const mockGetGuestToken = vi.fn();
const mockClearGuestSession = vi.fn();
const mockCaptureError = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
}));

vi.mock('convex/react', () => ({
  useConvexAuth: () => mockUseConvexAuth(),
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
}));

vi.mock('@clerk/nextjs', () => ({
  useUser: () => mockUseClerkUser(),
}));

vi.mock('@/lib/guestSession', () => ({
  clearGuestSession: () => mockClearGuestSession(),
  getGuestToken: () => mockGetGuestToken(),
}));

vi.mock('@/lib/error', () => ({
  captureError: (...args: unknown[]) => mockCaptureError(...args),
}));

import AuthCallbackPage from '@/app/(auth)/callback/page';

describe('AuthCallbackPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMutation.mockReturnValue(mockMigrateGuestToUser);
    mockUseClerkUser.mockReturnValue({
      isLoaded: true,
      isSignedIn: true,
    });
    mockUseConvexAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
    });
    mockGetGuestToken.mockReturnValue('guest-token');
  });

  it('redirects home immediately when no guest token exists', async () => {
    mockGetGuestToken.mockReturnValue(null);

    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/');
    });
    expect(mockMigrateGuestToUser).not.toHaveBeenCalled();
  });

  it('marks the initial migration state as busy', () => {
    mockMigrateGuestToUser.mockReturnValue(new Promise(() => {}));

    render(<AuthCallbackPage />);

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status')).toHaveTextContent(/completing sign in/i);
  });

  it('waits for Convex auth before attempting migration', () => {
    mockUseConvexAuth.mockReturnValue({
      isLoading: true,
      isAuthenticated: false,
    });

    render(<AuthCallbackPage />);

    expect(mockMigrateGuestToUser).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
  });

  it('shows recovery state when Clerk is ready but Convex auth is unavailable', async () => {
    mockUseConvexAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: false,
    });

    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(mockCaptureError).toHaveBeenCalledWith(
        expect.objectContaining({
          message:
            'Signed-in user missing Convex auth session during migration',
        }),
        expect.objectContaining({
          operation: 'migrateGuestToUser',
          phase: 'convexAuthUnavailable',
        })
      );
    });

    expect(mockMigrateGuestToUser).not.toHaveBeenCalled();
    expect(
      await screen.findByText(/could not finish sign in/i)
    ).toBeInTheDocument();
  });

  it('shows a recovery state instead of silently redirecting when migration fails', async () => {
    mockMigrateGuestToUser.mockRejectedValueOnce(new Error('migration failed'));

    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(mockCaptureError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ operation: 'migrateGuestToUser' })
      );
    });

    expect(screen.getByText(/could not finish sign in/i)).toBeInTheDocument();
    expect(
      screen.getByText(/guest progress could not be moved/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /retry migration/i })
    ).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('retries migration from the recovery state', async () => {
    mockMigrateGuestToUser
      .mockRejectedValueOnce(new Error('migration failed'))
      .mockResolvedValueOnce(undefined);

    render(<AuthCallbackPage />);

    await screen.findByRole('button', { name: /retry migration/i });

    fireEvent.click(screen.getByRole('button', { name: /retry migration/i }));

    await waitFor(() => {
      expect(mockMigrateGuestToUser).toHaveBeenCalledTimes(2);
      expect(mockClearGuestSession).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith('/');
    });
  });
});
