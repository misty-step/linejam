// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { cloneElement } from 'react';
import { E2E_TEST_IDS } from '@/lib/e2eTestIds';
import { Lobby, type LobbyDependencies } from '@/components/Lobby';
import type { Doc, Id } from '@/convex/_generated/dataModel';

const mockTrackLobbyReady = vi.fn();
const mockTrackGameStarted = vi.fn();

const mockMutations = {
  startGame: vi.fn(),
};

const lobbyDependencies: LobbyDependencies = {
  useUser: () => ({
    clerkUser: null,
    guestId: 'guest_123',
    guestToken: 'mock-token',
    isLoading: false,
    isAuthenticated: false,
    displayName: 'Guest',
    authError: null,
    retryAuth: vi.fn(),
  }),
  useStartGame: () => mockMutations.startGame,
  hashRoomId: () => '0123456789abcdef',
  trackLobbyReady: mockTrackLobbyReady,
  trackGameStarted: mockTrackGameStarted,
};

function renderLobby(
  ui: React.ReactElement<React.ComponentProps<typeof Lobby>>
) {
  return render(cloneElement(ui, { dependencies: lobbyDependencies }));
}

describe('Lobby component', () => {
  // SAFETY: Synthetic room document fixture for lobby tests.
  const mockRoom: Doc<'rooms'> = {
    // SAFETY: Synthetic Convex room ID for test fixture.
    _id: 'room_123' as Id<'rooms'>,
    _creationTime: Date.now(),
    createdAt: Date.now(),
    code: 'ABCD',
    // SAFETY: Synthetic Convex user ID for test fixture.
    hostUserId: 'user_host' as Id<'users'>,
    status: 'LOBBY',
  };

  const mockPlayers = [
    {
      // SAFETY: Synthetic Convex roomPlayer ID for test fixture.
      _id: 'player_1' as Id<'roomPlayers'>,
      _creationTime: Date.now(),
      // SAFETY: Synthetic Convex room ID for test fixture.
      roomId: 'room_123' as Id<'rooms'>,
      // SAFETY: Synthetic Convex user ID for test fixture.
      userId: 'user_host' as Id<'users'>,
      displayName: 'Host Player',
      joinedAt: Date.now(),
      stableId: 'stable_host_123',
    },
    {
      // SAFETY: Synthetic Convex roomPlayer ID for test fixture.
      _id: 'player_2' as Id<'roomPlayers'>,
      _creationTime: Date.now(),
      // SAFETY: Synthetic Convex room ID for test fixture.
      roomId: 'room_123' as Id<'rooms'>,
      // SAFETY: Synthetic Convex user ID for test fixture.
      userId: 'user_guest' as Id<'users'>,
      displayName: 'Guest Player',
      joinedAt: Date.now(),
      stableId: 'stable_guest_456',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockMutations.startGame.mockReset();
  });

  it('renders player list from room state', () => {
    renderLobby(<Lobby room={mockRoom} players={mockPlayers} isHost={false} />);

    // Assert - Both players should be visible
    expect(screen.getByText('Host Player')).toBeInTheDocument();
    expect(screen.getByText('Guest Player')).toBeInTheDocument();
  });

  it('shows the invitation and QR without hiding the start action', () => {
    renderLobby(<Lobby room={mockRoom} players={mockPlayers} isHost />);
    expect(
      screen.getByRole('region', { name: 'Room invitation' })
    ).toBeVisible();
    expect(
      screen.getByRole('img', { name: 'QR code for joining room AB CD' })
    ).toBeVisible();
    expect(screen.getByTestId(E2E_TEST_IDS.lobbyStartGameButton)).toBeEnabled();
  });

  it('Start Game button disabled with <2 players', () => {
    const singlePlayer = [mockPlayers[0]];

    renderLobby(<Lobby room={mockRoom} players={singlePlayer} isHost={true} />);

    const startButtons = screen.getAllByRole('button', {
      name: /Need .* player/i,
    });
    expect(startButtons[0]).toBeDisabled();
    expect(startButtons[0]).toHaveTextContent('Need 1 more player');
  });

  it('Start Game button enabled with ≥2 players', () => {
    renderLobby(<Lobby room={mockRoom} players={mockPlayers} isHost={true} />);

    const startButtons = screen.getAllByRole('button', {
      name: /Start Linejam/i,
    });
    expect(startButtons[0]).not.toBeDisabled();
  });

  it('emits lobby-ready and started only after a successful start with the next cycle', async () => {
    const rematchRoom = { ...mockRoom, currentCycle: 3 };
    mockMutations.startGame.mockResolvedValue(undefined);
    const user = userEvent.setup();

    renderLobby(
      <Lobby room={rematchRoom} players={mockPlayers} isHost={true} />
    );
    await user.click(
      screen.getAllByRole('button', { name: /Start Linejam/i })[0]
    );

    await waitFor(() => {
      expect(mockTrackLobbyReady).toHaveBeenCalledWith({
        roomIdHash: '0123456789abcdef',
        cycle: 4,
      });
      expect(mockTrackGameStarted).toHaveBeenCalledWith({
        roomIdHash: '0123456789abcdef',
        cycle: 4,
      });
    });
  });

  it('displays error message when startGame mutation fails', async () => {
    mockMutations.startGame.mockRejectedValue(new Error('Game start failed'));
    const user = userEvent.setup();

    renderLobby(<Lobby room={mockRoom} players={mockPlayers} isHost={true} />);

    const startButtons = screen.getAllByRole('button', {
      name: /Start Linejam/i,
    });

    await user.click(startButtons[0]);

    await waitFor(() => {
      const alerts = screen.getAllByText(/unexpected error/i);
      expect(alerts.length).toBeGreaterThan(0);
    });
    expect(mockTrackLobbyReady).not.toHaveBeenCalled();
    expect(mockTrackGameStarted).not.toHaveBeenCalled();
  });

  it('shows "Waiting for host" button when not host', () => {
    renderLobby(<Lobby room={mockRoom} players={mockPlayers} isHost={false} />);

    const waitingButtons = screen.getAllByRole('button', {
      name: /Waiting for host/i,
    });
    expect(waitingButtons[0]).toBeDisabled();
  });

  it('updates the visible roster when another player joins', () => {
    const latePlayer = {
      // SAFETY: Synthetic Convex roomPlayer ID for late joining player.
      _id: 'player_3' as Id<'roomPlayers'>,
      _creationTime: Date.now(),
      // SAFETY: Synthetic Convex room ID for test fixture.
      roomId: 'room_123' as Id<'rooms'>,
      // SAFETY: Synthetic Convex user ID for test fixture.
      userId: 'user_late' as Id<'users'>,
      displayName: 'Late Poet',
      joinedAt: Date.now(),
      stableId: 'stable_late_789',
    };
    const { rerender } = renderLobby(
      <Lobby room={mockRoom} players={mockPlayers} isHost={true} />
    );

    rerender(
      <Lobby
        room={mockRoom}
        players={[...mockPlayers, latePlayer]}
        isHost={true}
        dependencies={lobbyDependencies}
      />
    );

    expect(
      within(screen.getByRole('list', { name: 'Players' })).getByText(
        'Late Poet'
      )
    ).toBeVisible();
  });

  it('shows host badge for host player', () => {
    renderLobby(<Lobby room={mockRoom} players={mockPlayers} isHost={true} />);

    const hostPlayerItem = screen.getByText('Host Player').closest('li');
    expect(
      within(hostPlayerItem!).getByRole('status', { name: 'Room host' })
    ).toBeInTheDocument();
    const guestPlayerItem = screen.getByText('Guest Player').closest('li');
    expect(
      within(guestPlayerItem!).queryByRole('status', { name: 'Room host' })
    ).not.toBeInTheDocument();
  });
});
