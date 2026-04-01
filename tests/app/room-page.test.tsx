// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockReactUse = vi.fn();
const mockUseQuery = vi.fn();
const mockUseUser = vi.fn();

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    use: (value: unknown) => mockReactUse(value),
  };
});

vi.mock('convex/react', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

vi.mock('@/lib/auth', () => ({
  useUser: () => mockUseUser(),
}));

vi.mock('@/components/AuthErrorState', () => ({
  AuthErrorState: ({
    message,
    onRetry,
  }: {
    message: string;
    onRetry: () => void;
  }) => (
    <div>
      <span>{message}</span>
      <button onClick={onRetry}>Retry auth</button>
    </div>
  ),
}));

vi.mock('@/components/Lobby', () => ({
  Lobby: () => <div>Lobby screen</div>,
}));

vi.mock('@/components/WritingScreen', () => ({
  WritingScreen: () => <div>Writing screen</div>,
}));

vi.mock('@/components/RevealPhase', () => ({
  RevealPhase: () => <div>Reveal screen</div>,
}));

vi.mock('@/components/RoomChrome', () => ({
  RoomChrome: ({ roomCode }: { roomCode: string }) => (
    <div>Room chrome {roomCode}</div>
  ),
}));

import RoomPage from '@/app/room/[code]/page';

describe('RoomPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReactUse.mockReturnValue({ code: 'ABCD' });
    mockUseUser.mockReturnValue({
      isLoading: false,
      guestToken: 'guest-token',
      authError: null,
      retryAuth: vi.fn(),
    });
  });

  it('renders an explicit recovery state when room status is unknown', () => {
    mockUseQuery.mockReturnValue({
      room: {
        code: 'ABCD',
        status: 'BROKEN_STATE',
      },
      players: [],
      isHost: false,
    });

    render(<RoomPage params={Promise.resolve({ code: 'ABCD' })} />);

    expect(
      screen.getByText(/we lost track of this room state/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go home/i })).toHaveAttribute(
      'href',
      '/'
    );
    expect(screen.queryByText('Lobby screen')).not.toBeInTheDocument();
  });

  it('still renders the lobby for a known lobby state', () => {
    mockUseQuery.mockReturnValue({
      room: {
        code: 'ABCD',
        status: 'LOBBY',
      },
      players: [],
      isHost: true,
    });

    render(<RoomPage params={Promise.resolve({ code: 'ABCD' })} />);

    expect(screen.getByText('Lobby screen')).toBeInTheDocument();
  });
});
