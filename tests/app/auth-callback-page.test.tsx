// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  AuthCallbackPage,
  type AuthCallbackPageDependencies,
  type MigrateGuestToUser,
} from '@/app/(auth)/callback/page';

const mockReplace = vi.fn();
const mockMigrateGuestToUser = vi.fn<MigrateGuestToUser>();
const mockGetExistingGuestSession =
  vi.fn<AuthCallbackPageDependencies['getExistingGuestSession']>();
const mockClearGuestSession =
  vi.fn<AuthCallbackPageDependencies['clearGuestSession']>();
const mockCaptureError = vi.fn<AuthCallbackPageDependencies['captureError']>();

const mockRouter = { replace: mockReplace };
let clerkAuthState = {
  isLoaded: true,
  isSignedIn: true,
};
let convexAuthState = {
  isLoading: false,
  isAuthenticated: true,
};

const dependencies: AuthCallbackPageDependencies = {
  useRouter: () => mockRouter,
  useClerkUser: () => clerkAuthState,
  useConvexAuth: () => convexAuthState,
  useMigrateGuestToUser: () => mockMigrateGuestToUser,
  getExistingGuestSession: mockGetExistingGuestSession,
  clearGuestSession: mockClearGuestSession,
  captureError: mockCaptureError,
};

function renderAuthCallbackPage() {
  return render(<AuthCallbackPage dependencies={dependencies} />);
}

describe('AuthCallbackPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMigrateGuestToUser.mockResolvedValue(undefined);
    mockGetExistingGuestSession.mockResolvedValue({
      guestId: 'guest-id',
      token: 'guest-token',
    });
    mockClearGuestSession.mockResolvedValue(undefined);
    clerkAuthState = {
      isLoaded: true,
      isSignedIn: true,
    };
    convexAuthState = {
      isLoading: false,
      isAuthenticated: true,
    };
  });

  it('redirects home immediately when no guest token exists', async () => {
    mockGetExistingGuestSession.mockResolvedValue({
      guestId: null,
      token: null,
    });

    renderAuthCallbackPage();

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/');
    });
    expect(mockMigrateGuestToUser).not.toHaveBeenCalled();
  });

  it('marks the initial migration state as busy', () => {
    const { promise } = Promise.withResolvers<void>();
    mockMigrateGuestToUser.mockReturnValue(promise);

    renderAuthCallbackPage();

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status')).toHaveTextContent(/completing sign in/i);
  });

  it('waits for Convex auth before attempting migration', () => {
    convexAuthState = {
      isLoading: true,
      isAuthenticated: false,
    };

    renderAuthCallbackPage();

    expect(mockMigrateGuestToUser).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
  });

  it('shows recovery state when Clerk is ready but Convex auth is unavailable', async () => {
    convexAuthState = {
      isLoading: false,
      isAuthenticated: false,
    };

    renderAuthCallbackPage();

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

    renderAuthCallbackPage();

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
    mockGetExistingGuestSession
      .mockResolvedValueOnce({ guestId: 'guest-id', token: 'guest-token' })
      .mockResolvedValueOnce({ guestId: 'guest-id', token: 'guest-token' });

    renderAuthCallbackPage();

    await screen.findByRole('button', { name: /retry migration/i });

    fireEvent.click(screen.getByRole('button', { name: /retry migration/i }));

    await waitFor(() => {
      expect(mockMigrateGuestToUser).toHaveBeenCalledTimes(2);
      expect(mockClearGuestSession).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith('/');
    });
  });
});
