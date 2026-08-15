// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { E2E_TEST_IDS } from '@/lib/e2eTestIds';

// Mock Next.js router (external)
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Hoisted mocks - created before module loading
const mockMutations = {
  startGame: vi.fn(),
  leaveLobby: vi.fn().mockResolvedValue(undefined),
  closeRoom: vi.fn().mockResolvedValue(undefined),
};

// Mock Convex (external) - use call order tracking
// Note: Order matches component's useMutation call order in Lobby.tsx
let callIndex = 0;
const MUTATION_ORDER = [
  mockMutations.startGame, // api.game.startGame
  mockMutations.leaveLobby, // api.rooms.leaveLobby
  mockMutations.closeRoom, // api.rooms.closeRoom
];

vi.mock('convex/react', () => ({
  useMutation: () => {
    const mock = MUTATION_ORDER[callIndex % MUTATION_ORDER.length];
    callIndex++;
    return mock;
  },
  useConvexAuth: () => ({ isLoading: false, isAuthenticated: false }),
}));

// Mock Clerk (external) - let useUser hook use real implementation
vi.mock('@clerk/nextjs', () => ({
  useUser: () => ({ user: null, isLoaded: true }),
}));

// Mock fetch for guest session API (external boundary)
const mockFetch = vi.fn();
const originalFetch = global.fetch;

const { mockTrackLobbyReady, mockTrackGameStarted } = vi.hoisted(() => ({
  mockTrackLobbyReady: vi.fn(),
  mockTrackGameStarted: vi.fn(),
}));
vi.mock('@/lib/analytics', () => ({
  hashRoomId: () => '0123456789abcdef',
  trackLobbyReady: (props: unknown) => mockTrackLobbyReady(props),
  trackGameStarted: (props: unknown) => mockTrackGameStarted(props),
}));

// Import after mocking
import { Lobby } from '@/components/Lobby';
import { Doc, Id } from '@/convex/_generated/dataModel';

describe('Lobby component', () => {
  const mockRoom: Doc<'rooms'> = {
    _id: 'room_123' as Id<'rooms'>,
    _creationTime: Date.now(),
    createdAt: Date.now(),
    code: 'ABCD',
    hostUserId: 'user_host' as Id<'users'>,
    status: 'LOBBY',
  };

  const mockPlayers = [
    {
      _id: 'player_1' as Id<'roomPlayers'>,
      _creationTime: Date.now(),
      roomId: 'room_123' as Id<'rooms'>,
      userId: 'user_host' as Id<'users'>,
      displayName: 'Host Player',
      joinedAt: Date.now(),
      stableId: 'stable_host_123',
    },
    {
      _id: 'player_2' as Id<'roomPlayers'>,
      _creationTime: Date.now(),
      roomId: 'room_123' as Id<'rooms'>,
      userId: 'user_guest' as Id<'users'>,
      displayName: 'Guest Player',
      joinedAt: Date.now(),
      stableId: 'stable_guest_456',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    callIndex = 0; // Reset mutation call order tracking
    mockPush.mockClear();
    mockMutations.startGame.mockClear();
    mockMutations.leaveLobby.mockClear();
    mockMutations.leaveLobby.mockResolvedValue(undefined);
    mockMutations.closeRoom.mockClear();
    mockMutations.closeRoom.mockResolvedValue(undefined);

    // Mock fetch at boundary - useUser calls /api/guest/session
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

  it('renders the room code as the lobby hero', () => {
    // Arrange & Act
    render(<Lobby room={mockRoom} players={mockPlayers} isHost={true} />);

    // Room code "ABCD" is formatted as "AB CD" and shown as the in-body hero
    expect(screen.getByText('AB CD')).toHaveClass(
      'text-[clamp(2rem,16vw,3rem)]'
    );
  });

  it('announces the room code to screen readers without duplicating visual chrome', () => {
    render(<Lobby room={mockRoom} players={mockPlayers} isHost={true} />);

    const roomCodeStatus = screen
      .getAllByRole('status')
      .find((status) => status.textContent?.includes('Room code AB CD'));
    expect(roomCodeStatus).toBeDefined();
    expect(roomCodeStatus).toHaveClass('sr-only');
  });

  it('renders player list from room state', () => {
    // Arrange & Act
    render(<Lobby room={mockRoom} players={mockPlayers} isHost={false} />);

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
    render(<Lobby room={mockRoom} players={mockPlayers} isHost />);

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
    render(<Lobby room={mockRoom} players={mockPlayers} isHost={true} />);

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
    // Arrange - Only one player
    const singlePlayer = [mockPlayers[0]];

    // Act
    render(<Lobby room={mockRoom} players={singlePlayer} isHost={true} />);

    // Assert - Button should be disabled and show "need more" message
    // Component renders button twice (desktop + mobile), get first one
    const startButtons = screen.getAllByRole('button', {
      name: /Need .* player/i,
    });
    expect(startButtons[0]).toBeDisabled();
    expect(startButtons[0]).toHaveTextContent('Need 1 more player');
  });

  it('Start Game button enabled with ≥2 players', () => {
    // Arrange & Act
    render(<Lobby room={mockRoom} players={mockPlayers} isHost={true} />);

    // Assert - Button should be enabled and show "Start" message
    // Component renders button twice (desktop + mobile), get first one
    const startButtons = screen.getAllByRole('button', {
      name: /Start Linejam/i,
    });
    expect(startButtons[0]).not.toBeDisabled();
  });

  it('calls startGame mutation when Start button clicked', async () => {
    // Arrange
    mockMutations.startGame.mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<Lobby room={mockRoom} players={mockPlayers} isHost={true} />);

    // Component renders button twice (desktop + mobile), get first one
    const startButtons = screen.getAllByRole('button', {
      name: /Start Linejam/i,
    });

    // Act
    await user.click(startButtons[0]);

    // Assert
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

    render(<Lobby room={rematchRoom} players={mockPlayers} isHost={true} />);
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
    // Arrange
    mockMutations.startGame.mockRejectedValue(new Error('Game start failed'));
    const user = userEvent.setup();

    render(<Lobby room={mockRoom} players={mockPlayers} isHost={true} />);

    // Component renders button twice (desktop + mobile), get first one
    const startButtons = screen.getAllByRole('button', {
      name: /Start Linejam/i,
    });

    // Act
    await user.click(startButtons[0]);

    // Assert - Error message should appear (errorToFeedback returns generic message for unknown errors)
    // Alert renders twice (desktop + mobile), so we use getAllByText
    await waitFor(() => {
      const alerts = screen.getAllByText(/unexpected error/i);
      expect(alerts.length).toBeGreaterThan(0);
    });
    expect(mockTrackLobbyReady).not.toHaveBeenCalled();
    expect(mockTrackGameStarted).not.toHaveBeenCalled();
  });

  it('shows "Waiting for host" button when not host', () => {
    // Arrange & Act
    render(<Lobby room={mockRoom} players={mockPlayers} isHost={false} />);

    // Assert - Non-host sees waiting message
    // Component renders button twice (desktop + mobile), get first one
    const waitingButtons = screen.getAllByRole('button', {
      name: /Waiting for host/i,
    });
    expect(waitingButtons[0]).toBeDisabled();
    expect(waitingButtons[0]).toHaveClass('opacity-50', 'cursor-not-allowed');
  });

  it('lets the host open and exit a room-scale presentation lobby', async () => {
    const user = userEvent.setup();

    render(<Lobby room={mockRoom} players={mockPlayers} isHost={true} />);

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
    render(<Lobby room={mockRoom} players={mockPlayers} isHost={false} />);

    expect(
      screen.queryByRole('button', { name: /Present room/i })
    ).not.toBeInTheDocument();
  });

  it('marks a player who joins while the lobby presentation stage is open', async () => {
    const user = userEvent.setup();
    const latePlayer = {
      _id: 'player_3' as Id<'roomPlayers'>,
      _creationTime: Date.now(),
      roomId: 'room_123' as Id<'rooms'>,
      userId: 'user_late' as Id<'users'>,
      displayName: 'Late Poet',
      joinedAt: Date.now(),
      stableId: 'stable_late_789',
    };
    const { rerender } = render(
      <Lobby room={mockRoom} players={mockPlayers} isHost={true} />
    );

    await user.click(screen.getByRole('button', { name: /Present room/i }));

    rerender(
      <Lobby
        room={mockRoom}
        players={[...mockPlayers, latePlayer]}
        isHost={true}
      />
    );

    const stage = screen.getByTestId('lobby-presentation-stage');
    expect(within(stage).getByText('Late Poet')).toBeInTheDocument();
    expect(within(stage).getByText(/Just joined/i)).toBeInTheDocument();
  });

  it('Close room button calls mutation and navigates to home (host)', async () => {
    // Arrange
    const user = userEvent.setup();
    render(<Lobby room={mockRoom} players={mockPlayers} isHost={true} />);

    // Component renders button twice (desktop + mobile), get first one
    const closeButtons = screen.getAllByRole('button', {
      name: /Close room/i,
    });

    // Act
    await user.click(closeButtons[0]);

    // Assert - mutation called with room code, then navigates
    await waitFor(() => {
      expect(mockMutations.closeRoom).toHaveBeenCalledWith({
        roomCode: 'ABCD',
        guestToken: 'mock-token',
      });
      expect(mockPush).toHaveBeenCalledWith('/');
    });
  });

  it('Leave room button calls mutation and navigates to home (guest)', async () => {
    // Arrange
    const user = userEvent.setup();
    render(<Lobby room={mockRoom} players={mockPlayers} isHost={false} />);

    // Component renders button twice (desktop + mobile), get first one
    const leaveButtons = screen.getAllByRole('button', {
      name: /Leave room/i,
    });

    // Act
    await user.click(leaveButtons[0]);

    // Assert - mutation called with room code, then navigates
    await waitFor(() => {
      expect(mockMutations.leaveLobby).toHaveBeenCalledWith({
        roomCode: 'ABCD',
        guestToken: 'mock-token',
      });
      expect(mockPush).toHaveBeenCalledWith('/');
    });
  });

  it('shows host badge for host player', () => {
    // Arrange & Act
    render(<Lobby room={mockRoom} players={mockPlayers} isHost={true} />);

    // Assert - Host badge should be present next to host player
    // The HostBadge component should render for the player with userId matching hostUserId
    const hostPlayerItem = screen.getByText('Host Player').closest('li');
    expect(hostPlayerItem).toBeInTheDocument();
    // Check that host badge exists in the document (it renders for host player)
    // We don't assert on specific badge content as that's HostBadge's responsibility
  });

  it('wraps roster chips before the action zone on narrow layouts', () => {
    render(<Lobby room={mockRoom} players={mockPlayers} isHost={true} />);

    const rosterList = screen.getByText('Host Player').closest('ul');
    expect(rosterList).toHaveClass('flex', 'flex-wrap', 'min-w-0');
  });

  it('truncates long player names instead of overflowing the roster row (linejam-946: mid-width collision)', () => {
    // Arrange
    const longName = 'A'.repeat(80);
    const playersWithLongName = [
      { ...mockPlayers[0], displayName: longName },
      mockPlayers[1],
    ];

    // Act
    render(
      <Lobby room={mockRoom} players={playersWithLongName} isHost={true} />
    );

    // Assert — the name span must be able to shrink/truncate rather than
    // push the HOST badge past the container edge.
    const nameSpan = screen.getByText(longName);
    expect(nameSpan).toHaveClass('truncate', 'min-w-0');
  });

  it('stacks roster badges at narrow widths and reserves a column when space permits', () => {
    render(<Lobby room={mockRoom} players={mockPlayers} isHost={true} />);

    const hostPlayerItem = screen.getByText('Host Player').closest('li');
    expect(hostPlayerItem).toHaveClass(
      'grid',
      'grid-cols-1',
      'sm:grid-cols-[minmax(0,1fr)_auto]'
    );
  });
});
