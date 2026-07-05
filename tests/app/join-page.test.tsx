// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import JoinPage from '@/app/join/page';

// linejam-911 (coverage ratchet): app/join/page.tsx was the lowest-covered
// major page in the repo (48% statements / 37% branches) with no existing
// test at all -- exactly the highest-risk gap the card asks for, and the
// same join flow errors.spec.ts already covers behaviorally at the E2E
// layer but never at the unit/component layer.

const mockPush = vi.fn();
const mockJoinRoomMutation = vi.fn();
const mockTrackGameJoined = vi.fn();
const mockCaptureError = vi.fn();
const mockRetryAuth = vi.fn();
const mockSearchParamsGet = vi.fn<(key: string) => string | null>(() => null);

const mockUseUserReturn: {
  guestToken: string | null;
  isLoading: boolean;
  authError: string | null;
  retryAuth: () => void;
} = {
  guestToken: 'mock-guest-token',
  isLoading: false,
  authError: null,
  retryAuth: mockRetryAuth,
};

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({ get: mockSearchParamsGet }),
}));

vi.mock('convex/react', () => ({
  useMutation: () => mockJoinRoomMutation,
}));

vi.mock('@/lib/auth', () => ({
  useUser: () => mockUseUserReturn,
}));

vi.mock('@/lib/analytics', () => ({
  trackGameJoined: (...args: unknown[]) => mockTrackGameJoined(...args),
}));

vi.mock('@/lib/error', () => ({
  captureError: (...args: unknown[]) => mockCaptureError(...args),
}));

beforeEach(() => {
  mockPush.mockReset();
  mockJoinRoomMutation.mockReset();
  mockTrackGameJoined.mockReset();
  mockCaptureError.mockReset();
  mockRetryAuth.mockReset();
  mockSearchParamsGet.mockReset().mockReturnValue(null);
  mockUseUserReturn.guestToken = 'mock-guest-token';
  mockUseUserReturn.isLoading = false;
  mockUseUserReturn.authError = null;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('JoinPage', () => {
  it('shows a loading state while auth is resolving', () => {
    mockUseUserReturn.isLoading = true;
    render(<JoinPage />);
    expect(screen.getByText(/joining/i)).toBeInTheDocument();
  });

  it('shows the auth error state with a retry action instead of the form', () => {
    mockUseUserReturn.authError = 'Clerk is unreachable';
    render(<JoinPage />);
    expect(screen.getByText('Clerk is unreachable')).toBeInTheDocument();
    expect(screen.queryByLabelText(/room code/i)).not.toBeInTheDocument();
  });

  it('prefills the room code from the ?code= query param', () => {
    mockSearchParamsGet.mockImplementation((key: string) =>
      key === 'code' ? 'abcd' : null
    );
    render(<JoinPage />);
    expect(screen.getByDisplayValue('ABCD')).toBeInTheDocument();
  });

  it('disables submit until both code and name are filled', async () => {
    const user = userEvent.setup();
    render(<JoinPage />);

    const button = screen.getByRole('button', { name: /enter room/i });
    expect(button).toBeDisabled();

    await user.type(screen.getByLabelText(/room code/i), 'ABCD');
    expect(button).toBeDisabled();

    await user.type(screen.getByLabelText(/your name/i), 'Alice');
    expect(button).toBeEnabled();
  });

  it('joins the room and navigates there on success', async () => {
    mockJoinRoomMutation.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<JoinPage />);

    await user.type(screen.getByLabelText(/room code/i), 'abcd');
    await user.type(screen.getByLabelText(/your name/i), 'Alice');
    await user.click(screen.getByRole('button', { name: /enter room/i }));

    await waitFor(() => {
      expect(mockJoinRoomMutation).toHaveBeenCalledWith({
        code: 'ABCD',
        displayName: 'Alice',
        guestToken: 'mock-guest-token',
      });
    });
    expect(mockTrackGameJoined).toHaveBeenCalledWith({ roomCode: 'ABCD' });
    expect(mockPush).toHaveBeenCalledWith('/room/ABCD');
  });

  it('strips whitespace from a pasted room code before submitting', async () => {
    mockJoinRoomMutation.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<JoinPage />);

    // Room code input uppercases as typed; simulate a code with an embedded
    // space the way a pasted "AB CD" might arrive.
    await user.type(screen.getByLabelText(/room code/i), 'AB CD'.slice(0, 4));
    await user.type(screen.getByLabelText(/your name/i), 'Alice');
    await user.click(screen.getByRole('button', { name: /enter room/i }));

    await waitFor(() => {
      expect(mockJoinRoomMutation).toHaveBeenCalled();
    });
    const [call] = mockJoinRoomMutation.mock.calls[0];
    expect(call.code).not.toMatch(/\s/);
  });

  it('shows a friendly error and re-enables submit when joining fails', async () => {
    mockJoinRoomMutation.mockRejectedValue(new Error('Room code not found'));
    const user = userEvent.setup();
    render(<JoinPage />);

    await user.type(screen.getByLabelText(/room code/i), 'ZZZZ');
    await user.type(screen.getByLabelText(/your name/i), 'Alice');
    await user.click(screen.getByRole('button', { name: /enter room/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockCaptureError).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /enter room/i })).toBeEnabled();
  });
});
