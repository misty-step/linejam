// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { cloneElement } from 'react';
import {
  WaitingScreen,
  type WaitingScreenDependencies,
} from '@/components/WaitingScreen';
import { useUser, type UseUserAuthDependencies } from '@/lib/auth';
import { defaultGuestSessionFetcher } from '@/lib/guestSession';
import {
  useRoomQueryArgs,
  type RoomQueryArgsDependencies,
} from '@/hooks/useRoomQueryArgs';
// Exercise the real auth bootstrap against controlled provider boundaries.
const mockUseQuery = vi.fn();
const mockEndGame = vi.fn().mockResolvedValue({ abandoned: true });

const testUserDependencies: UseUserAuthDependencies = {
  useClerk: () => ({ user: null, isLoaded: true }),
  useConvex: () => ({ isLoading: false, isAuthenticated: false }),
  onError: vi.fn(),
};

function useTestUser() {
  return useUser(defaultGuestSessionFetcher, testUserDependencies);
}

const roomQueryArgsDependencies: RoomQueryArgsDependencies = {
  useUser: useTestUser,
};

function useTestRoomQueryArgs(roomCode: string, propToken?: string | null) {
  return useRoomQueryArgs(roomCode, propToken, roomQueryArgsDependencies);
}
function useReadyRoomQueryArgs(roomCode: string, propToken?: string | null) {
  const guestToken = propToken ?? 'mock-token';
  return {
    guestToken,
    shouldSkip: false,
    queryArgs: { roomCode, guestToken },
  };
}

const waitingScreenDependencies: WaitingScreenDependencies = {
  useRoomQueryArgs: useReadyRoomQueryArgs,
  useRoundProgress: (args) => mockUseQuery('game:getRoundProgress', args),
  useEndGame: () => mockEndGame,
};
const authWaitingScreenDependencies: WaitingScreenDependencies = {
  useRoomQueryArgs: useTestRoomQueryArgs,
  useRoundProgress: (args) => mockUseQuery('game:getRoundProgress', args),
  useEndGame: () => mockEndGame,
};

// Mock fetch for guest session API (external boundary)
const mockFetch = vi.fn();
const originalFetch = global.fetch;

function renderWaitingScreen(
  ui: React.ReactElement<React.ComponentProps<typeof WaitingScreen>>,
  dependencies: WaitingScreenDependencies = waitingScreenDependencies
) {
  return render(
    cloneElement(ui, {
      dependencies,
    })
  );
}

describe('WaitingScreen component', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ guestId: 'guest_123', token: 'mock-token' }),
    });
    global.fetch = mockFetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('displays loading state when progress is undefined', () => {
    mockUseQuery.mockReturnValue(undefined);

    renderWaitingScreen(<WaitingScreen roomCode="ABCD" />);

    // LoadingState shows "Preparing your writing desk..." for LOADING_ROOM
    expect(
      screen.getByText(/Preparing your writing desk/i)
    ).toBeInTheDocument();
  });

  it('skips query when auth is in error and no token is available', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Unable to connect'));
    mockUseQuery.mockReturnValue(undefined);

    renderWaitingScreen(
      <WaitingScreen roomCode="ABCD" />,
      authWaitingScreenDependencies
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
    expect(mockUseQuery).toHaveBeenCalledWith(expect.anything(), 'skip');
    expect(mockUseQuery.mock.calls.every((call) => call[1] === 'skip')).toBe(
      true
    );
  });

  it('uses provided token even when auth is in error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Unable to connect'));
    mockUseQuery.mockReturnValue(undefined);

    renderWaitingScreen(
      <WaitingScreen roomCode="ABCD" guestToken="prop-token" />,
      authWaitingScreenDependencies
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        roomCode: 'ABCD',
        guestToken: 'prop-token',
      })
    );
    expect(mockUseQuery.mock.calls.some((call) => call[1] === 'skip')).toBe(
      false
    );
  });

  it('stays neutral when progress is null (round just resolved)', () => {
    // Null can mean "the game just completed" for a real participant; the
    // room page swaps phases on the same update, so we must not flash an
    // alarming "Room not found" — show the calm loading copy instead.
    mockUseQuery.mockReturnValue(null);

    renderWaitingScreen(<WaitingScreen roomCode="ABCD" />);

    expect(
      screen.getByText(/Preparing your writing desk/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/Room not found/i)).toBeNull();
  });

  it('displays round information when progress is available', () => {
    mockUseQuery.mockReturnValue({
      round: 1,
      totalRounds: 3,
      currentWordCount: 1,
      playerCount: 2,
      submittedCount: 1,
      isHost: false,
      players: [
        {
          stableId: 'player_1',
          displayName: 'Alice',
          submitted: true,
        },
        {
          stableId: 'player_2',
          displayName: 'Bob',
          submitted: false,
        },
      ],
    });

    renderWaitingScreen(<WaitingScreen roomCode="ABCD" />);

    expect(screen.getByText(/Round 2 · 1 of 2 ready/i)).toBeInTheDocument();
  });

  it('fills and scrolls its parent frame when embedded after submission', () => {
    mockUseQuery.mockReturnValue({
      round: 1,
      totalRounds: 3,
      currentWordCount: 1,
      playerCount: 2,
      submittedCount: 1,
      isHost: false,
      players: [
        {
          stableId: 'player_1',
          displayName: 'Alice',
          submitted: true,
        },
      ],
    });

    renderWaitingScreen(<WaitingScreen roomCode="ABCD" />);

    const root = screen.getByTestId('waiting-screen');
    expect(root).toHaveClass('h-full', 'overflow-y-auto');
    expect(root.firstElementChild).toHaveClass('min-h-full');
  });

  it('shows "It\'s around the table now." when not all players submitted', () => {
    mockUseQuery.mockReturnValue({
      round: 2,
      totalRounds: 3,
      currentWordCount: 2,
      playerCount: 3,
      submittedCount: 2,
      isHost: false,
      players: [
        {
          stableId: 'player_1',
          displayName: 'Alice',
          submitted: true,
        },
        {
          stableId: 'player_2',
          displayName: 'Bob',
          submitted: true,
        },
        {
          stableId: 'player_3',
          displayName: 'Charlie',
          submitted: false,
        },
      ],
    });

    renderWaitingScreen(<WaitingScreen roomCode="ABCD" />);

    expect(screen.getByText("It's around the table now.")).toBeInTheDocument();
    expect(screen.getByText(/Round 3 · 2 of 3 ready/i)).toBeInTheDocument();
  });

  it('shows "Ready" when all players have submitted', () => {
    mockUseQuery.mockReturnValue({
      round: 2,
      totalRounds: 3,
      currentWordCount: 3,
      playerCount: 2,
      submittedCount: 2,
      isHost: false,
      players: [
        {
          stableId: 'player_1',
          displayName: 'Alice',
          submitted: true,
        },
        {
          stableId: 'player_2',
          displayName: 'Bob',
          submitted: true,
        },
      ],
    });

    renderWaitingScreen(<WaitingScreen roomCode="ABCD" />);

    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.queryByText(/of.*ready/i)).not.toBeInTheDocument();
  });

  it('uses progressOverride data and skips the round progress query', () => {
    const override = {
      round: 2,
      totalRounds: 5,
      currentWordCount: 2,
      playerCount: 4,
      submittedCount: 3,
      isHost: false,
      players: [
        {
          userId: 'user_1',
          stableId: 'p1',
          displayName: 'Player 1',
          submitted: true,
        },
        {
          userId: 'user_2',
          stableId: 'p2',
          displayName: 'Player 2',
          submitted: true,
        },
        {
          userId: 'user_3',
          stableId: 'p3',
          displayName: 'Player 3',
          submitted: true,
        },
        {
          userId: 'user_4',
          stableId: 'p4',
          displayName: 'Player 4',
          submitted: false,
        },
      ],
    };

    renderWaitingScreen(
      <WaitingScreen roomCode="ABCD" progressOverride={override} />
    );

    expect(screen.getByText(/Round 3 · 3 of 4 ready/i)).toBeInTheDocument();
    expect(mockUseQuery).toHaveBeenCalledWith(expect.anything(), 'skip');
  });

  it('renders player avatars for each player', () => {
    mockUseQuery.mockReturnValue({
      round: 1,
      totalRounds: 3,
      currentWordCount: 1,
      playerCount: 2,
      submittedCount: 1,
      isHost: false,
      players: [
        {
          stableId: 'player_1',
          displayName: 'Alice',
          submitted: true,
        },
        {
          stableId: 'player_2',
          displayName: 'Bob',
          submitted: false,
        },
      ],
    });

    renderWaitingScreen(<WaitingScreen roomCode="ABCD" />);

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('applies different styling for submitted vs not-submitted players', () => {
    mockUseQuery.mockReturnValue({
      round: 1,
      totalRounds: 3,
      currentWordCount: 1,
      playerCount: 2,
      submittedCount: 1,
      isHost: false,
      players: [
        {
          stableId: 'player_1',
          displayName: 'Alice',
          submitted: true,
        },
        {
          stableId: 'player_2',
          displayName: 'Bob',
          submitted: false,
        },
      ],
    });

    renderWaitingScreen(<WaitingScreen roomCode="ABCD" />);

    const aliceItem = screen.getByText('Alice').closest('li');
    const bobItem = screen.getByText('Bob').closest('li');

    expect(aliceItem).toHaveClass('opacity-60');
    expect(bobItem).not.toHaveClass('opacity-60');
  });

  it('displays strike-through for submitted player names', () => {
    mockUseQuery.mockReturnValue({
      round: 1,
      totalRounds: 3,
      currentWordCount: 1,
      playerCount: 2,
      submittedCount: 1,
      isHost: false,
      players: [
        {
          stableId: 'player_1',
          displayName: 'Alice',
          submitted: true,
        },
        {
          stableId: 'player_2',
          displayName: 'Bob',
          submitted: false,
        },
      ],
    });

    renderWaitingScreen(<WaitingScreen roomCode="ABCD" />);

    const aliceName = screen.getByText('Alice');
    const bobName = screen.getByText('Bob');

    expect(aliceName).toHaveClass('line-through');
    expect(bobName).not.toHaveClass('line-through');
  });

  it('names who the room is waiting on (legible without a hover)', () => {
    mockUseQuery.mockReturnValue({
      round: 1,
      totalRounds: 3,
      currentWordCount: 1,
      playerCount: 3,
      submittedCount: 1,
      isHost: false,
      players: [
        {
          stableId: 'player_1',
          displayName: 'Alice',
          submitted: true,
        },
        {
          stableId: 'player_2',
          displayName: 'Bob',
          submitted: false,
        },
        {
          stableId: 'player_3',
          displayName: 'Charlie',
          submitted: false,
        },
      ],
    });

    renderWaitingScreen(<WaitingScreen roomCode="ABCD" />);

    expect(screen.getByText('Waiting on Bob, Charlie')).toBeInTheDocument();
  });

  it('does not count late spectators as missing round submissions', () => {
    mockUseQuery.mockReturnValue({
      round: 2,
      totalRounds: 3,
      currentWordCount: 2,
      playerCount: 3,
      submittedCount: 2,
      isHost: false,
      players: [
        {
          stableId: 'player_1',
          displayName: 'Alice',
          submitted: true,
          isSpectator: false,
        },
        {
          stableId: 'player_2',
          displayName: 'Bob',
          submitted: true,
          isSpectator: false,
        },
        {
          stableId: 'player_3',
          displayName: 'Late Spectator',
          submitted: false,
          isSpectator: true,
        },
      ],
    });

    renderWaitingScreen(<WaitingScreen roomCode="ABCD" />);

    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.getByText('Late Spectator')).toBeInTheDocument();
    expect(screen.getByText('watching')).toBeInTheDocument();
    expect(screen.queryByText(/of.*ready/i)).not.toBeInTheDocument();
  });

  it('lets the host confirm ending the game without revealing partial poems', async () => {
    const user = userEvent.setup();
    mockUseQuery.mockReturnValue({
      round: 2,
      totalRounds: 3,
      currentWordCount: 2,
      playerCount: 2,
      submittedCount: 1,
      isHost: true,
      players: [
        {
          stableId: 'player_1',
          displayName: 'Alice',
          submitted: true,
        },
        {
          stableId: 'player_2',
          displayName: 'Bob',
          submitted: false,
        },
      ],
    });

    renderWaitingScreen(<WaitingScreen roomCode="ABCD" />);

    const endTrigger = screen.getByRole('button', { name: 'End game' });
    expect(endTrigger).toBeInTheDocument();

    await user.click(endTrigger);

    expect(
      screen.getByText(/Partial poems are not revealed/i)
    ).toBeInTheDocument();

    const confirmButton = screen.getByRole('button', { name: 'End game' });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(mockEndGame).toHaveBeenCalledWith({
        roomCode: 'ABCD',
        guestToken: 'mock-token',
      });
    });
  });

  it('hides the end-game action from non-hosts', () => {
    mockUseQuery.mockReturnValue({
      round: 2,
      totalRounds: 3,
      currentWordCount: 2,
      playerCount: 2,
      submittedCount: 1,
      isHost: false,
      players: [
        {
          stableId: 'player_1',
          displayName: 'Alice',
          submitted: true,
        },
        {
          stableId: 'player_2',
          displayName: 'Bob',
          submitted: false,
        },
      ],
    });

    renderWaitingScreen(<WaitingScreen roomCode="ABCD" />);

    expect(
      screen.queryByRole('button', { name: /End game/i })
    ).not.toBeInTheDocument();
  });
});
