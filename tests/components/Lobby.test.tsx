// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { cloneElement } from 'react';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { E2E_TEST_IDS } from '@/lib/e2eTestIds';
import { Lobby, type LobbyDependencies } from '@/components/Lobby';
import type { Doc, Id } from '@/convex/_generated/dataModel';

const mockPush = vi.fn();
const mockTrackLobbyReady = vi.fn();
const mockTrackGameStarted = vi.fn();

const mockMutations = {
  startGame: vi.fn(),
  leaveLobby: vi.fn().mockResolvedValue(undefined),
  closeRoom: vi.fn().mockResolvedValue(undefined),
};

const mockRouter: AppRouterInstance = {
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  push: mockPush,
  replace: vi.fn(),
  prefetch: vi.fn(),
  bfcacheId: '',
};

const lobbyDependencies: LobbyDependencies = {
  useRouter: () => mockRouter,
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
  useLeaveLobby: () => mockMutations.leaveLobby,
  useCloseRoom: () => mockMutations.closeRoom,
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
    mockPush.mockClear();
    mockMutations.startGame.mockClear();
    mockMutations.leaveLobby.mockClear();
    mockMutations.leaveLobby.mockResolvedValue(undefined);
    mockMutations.closeRoom.mockClear();
    mockMutations.closeRoom.mockResolvedValue(undefined);
  });

  it('renders the room code as the lobby hero', () => {
    renderLobby(<Lobby room={mockRoom} players={mockPlayers} isHost={true} />);

    // Room code "ABCD" is formatted as "AB CD" and shown as the in-body hero
    expect(screen.getByText('AB CD')).toHaveClass(
      'text-[clamp(2rem,16vw,3rem)]'
    );
  });

  it('announces the room code to screen readers without duplicating visual chrome', () => {
    renderLobby(<Lobby room={mockRoom} players={mockPlayers} isHost={true} />);

    const roomCodeStatus = screen
      .getAllByRole('status')
      .find((status) => status.textContent?.includes('Room code AB CD'));
    expect(roomCodeStatus).toBeDefined();
    expect(roomCodeStatus).toHaveClass('sr-only');
  });

  it('renders player list from room state', () => {
    renderLobby(<Lobby room={mockRoom} players={mockPlayers} isHost={false} />);

    // Assert - Both players should be visible
    expect(screen.getByText('Host Player')).toBeInTheDocument();
    expect(screen.getByText('Guest Player')).toBeInTheDocument();
    expect(screen.getByText('Host Player').parentElement).toHaveClass(
      'min-w-0',
      'max-w-full',
      'flex-1'
    );
    expect(
      screen.getByText('Host Player').closest('.animate-stamp')
    ).toHaveClass('mx-[12px]', 'sm:mx-0');
  });

  it('puts lobby utilities behind the Status Board room-tools disclosure', async () => {
    const user = userEvent.setup();
    renderLobby(<Lobby room={mockRoom} players={mockPlayers} isHost />);

    const tools = screen.getByText('Room tools').closest('summary');
    expect(tools).toBeInTheDocument();
    expect(tools?.parentElement).not.toHaveAttribute('open');

    await user.click(tools!);

    expect(tools?.parentElement).toHaveAttribute('open');
    expect(
      screen.getByRole('button', { name: /Present room/i })
    ).toBeInTheDocument();
    expect(screen.getByTestId('lobby-join-qr')).toBeInTheDocument();
  });

  it('keeps the primary action in a non-overlapping viewport sibling', () => {
    renderLobby(<Lobby room={mockRoom} players={mockPlayers} isHost={true} />);

    const scrollRegion = screen.getByTestId(E2E_TEST_IDS.lobbyScrollRegion);
    const actionZone = screen.getByTestId(E2E_TEST_IDS.lobbyActionZone);
    const start = screen.getByTestId(E2E_TEST_IDS.lobbyStartGameButton);

    expect(scrollRegion.parentElement).toBe(actionZone.parentElement);
    expect(scrollRegion.nextElementSibling).toBe(actionZone);
    expect(scrollRegion).toHaveClass('min-h-0', 'overflow-y-auto');
    expect(actionZone).toHaveClass('min-h-0', 'max-h-[50%]', 'flex-[0_1_auto]');
    expect(start).toHaveClass(
      'min-h-[64px]',
      'h-auto',
      'min-w-0',
      'px-[16px]',
      'py-[12px]'
    );
    expect(actionZone).not.toHaveClass('flex-none');
    expect(actionZone).not.toHaveClass('fixed', 'sticky');
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

  it('calls startGame mutation when Start button clicked', async () => {
    mockMutations.startGame.mockResolvedValue(undefined);
    const user = userEvent.setup();

    renderLobby(<Lobby room={mockRoom} players={mockPlayers} isHost={true} />);

    const startButtons = screen.getAllByRole('button', {
      name: /Start Linejam/i,
    });

    await user.click(startButtons[0]);

    await waitFor(() => {
      expect(mockMutations.startGame).toHaveBeenCalledWith({
        code: 'ABCD',
        guestToken: 'mock-token',
      });
    });
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
    expect(waitingButtons[0]).toHaveClass('opacity-50', 'cursor-not-allowed');
  });

  it('lets the host open and exit a room-scale presentation lobby', async () => {
    const user = userEvent.setup();

    renderLobby(<Lobby room={mockRoom} players={mockPlayers} isHost={true} />);

    await user.click(screen.getByRole('button', { name: /Present room/i }));

    const stage = screen.getByTestId('lobby-presentation-stage');
    expect(
      within(stage).getByRole('heading', { name: /Join from any phone/i })
    ).toBeInTheDocument();
    expect(within(stage).getByText('AB CD')).toBeInTheDocument();
    expect(
      within(stage).getByLabelText(/QR code for joining room AB CD/i)
    ).toBeInTheDocument();
    expect(within(stage).getByText('Host Player')).toBeInTheDocument();
    expect(within(stage).getByText('Guest Player')).toBeInTheDocument();

    await user.click(
      within(stage).getByRole('button', { name: /Exit presentation/i })
    );

    expect(screen.queryByTestId('lobby-presentation-stage')).toBeNull();
  });

  it('keeps presentation mode host-only in the lobby', () => {
    renderLobby(<Lobby room={mockRoom} players={mockPlayers} isHost={false} />);

    expect(
      screen.queryByRole('button', { name: /Present room/i })
    ).not.toBeInTheDocument();
  });

  it('marks a player who joins while the lobby presentation stage is open', async () => {
    const user = userEvent.setup();
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

    await user.click(screen.getByRole('button', { name: /Present room/i }));

    rerender(
      <Lobby
        room={mockRoom}
        players={[...mockPlayers, latePlayer]}
        isHost={true}
        dependencies={lobbyDependencies}
      />
    );

    const stage = screen.getByTestId('lobby-presentation-stage');
    expect(within(stage).getByText('Late Poet')).toBeInTheDocument();
    expect(within(stage).getByText(/Just joined/i)).toBeInTheDocument();
  });

  it('Close room button calls mutation and navigates to home (host)', async () => {
    const user = userEvent.setup();
    renderLobby(<Lobby room={mockRoom} players={mockPlayers} isHost={true} />);

    const closeButtons = screen.getAllByRole('button', {
      name: /Close room/i,
    });

    await user.click(closeButtons[0]);

    await waitFor(() => {
      expect(mockMutations.closeRoom).toHaveBeenCalledWith({
        roomCode: 'ABCD',
        guestToken: 'mock-token',
      });
      expect(mockPush).toHaveBeenCalledWith('/');
    });
  });

  it('Leave room button calls mutation and navigates to home (guest)', async () => {
    const user = userEvent.setup();
    renderLobby(<Lobby room={mockRoom} players={mockPlayers} isHost={false} />);

    const leaveButtons = screen.getAllByRole('button', {
      name: /Leave room/i,
    });

    await user.click(leaveButtons[0]);

    await waitFor(() => {
      expect(mockMutations.leaveLobby).toHaveBeenCalledWith({
        roomCode: 'ABCD',
        guestToken: 'mock-token',
      });
      expect(mockPush).toHaveBeenCalledWith('/');
    });
  });

  it('shows host badge for host player', () => {
    renderLobby(<Lobby room={mockRoom} players={mockPlayers} isHost={true} />);

    const hostPlayerItem = screen.getByText('Host Player').closest('li');
    expect(hostPlayerItem).toBeInTheDocument();
  });

  it('wraps roster chips before the action zone on narrow layouts', () => {
    renderLobby(<Lobby room={mockRoom} players={mockPlayers} isHost={true} />);

    const rosterList = screen.getByText('Host Player').closest('ul');
    expect(rosterList).toHaveClass('flex', 'flex-wrap', 'min-w-0');
  });

  it('truncates long player names instead of overflowing the roster row (linejam-946: mid-width collision)', () => {
    const longName = 'A'.repeat(80);
    const playersWithLongName = [
      { ...mockPlayers[0], displayName: longName },
      mockPlayers[1],
    ];

    renderLobby(
      <Lobby room={mockRoom} players={playersWithLongName} isHost={true} />
    );

    const nameSpan = screen.getByText(longName);
    expect(nameSpan).toHaveClass('truncate', 'min-w-0');
  });

  it('stacks roster badges at narrow widths and reserves a column when space permits', () => {
    renderLobby(<Lobby room={mockRoom} players={mockPlayers} isHost={true} />);

    const hostPlayerItem = screen.getByText('Host Player').closest('li');
    expect(hostPlayerItem).toHaveClass(
      'grid',
      'grid-cols-1',
      'sm:grid-cols-[minmax(0,1fr)_auto]'
    );
  });
});
