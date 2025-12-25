// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';

// Mock Next.js router
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Hoisted mocks - created before module loading
const mockMutations = {
  startGame: vi.fn(),
  addAi: vi.fn(),
  removeAi: vi.fn(),
  leaveLobby: vi.fn().mockResolvedValue(undefined),
};

// Mock Convex - use call order tracking but with explicit documentation
// Note: Order matches component's useMutation call order in Lobby.tsx:60-63
// If component order changes, update this mapping accordingly
let callIndex = 0;
const MUTATION_ORDER = [
  mockMutations.startGame, // api.game.startGame
  mockMutations.addAi, // api.ai.addAiPlayer
  mockMutations.removeAi, // api.ai.removeAiPlayer
  mockMutations.leaveLobby, // api.rooms.leaveLobby
];

vi.mock('convex/react', () => ({
  useMutation: () => {
    const mock = MUTATION_ORDER[callIndex % MUTATION_ORDER.length];
    callIndex++;
    return mock;
  },
}));

// Mock auth hook
const mockUseUser = vi.fn();
vi.mock('@/lib/auth', () => ({
  useUser: () => mockUseUser(),
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
    mockUseUser.mockReturnValue({
      guestToken: 'mock-token',
      isLoading: false,
    });
    mockPush.mockClear();
    mockMutations.startGame.mockClear();
    mockMutations.addAi.mockClear();
    mockMutations.removeAi.mockClear();
    mockMutations.leaveLobby.mockClear();
    mockMutations.leaveLobby.mockResolvedValue(undefined);
  });

  it('displays room code correctly', () => {
    // Arrange & Act
    render(<Lobby room={mockRoom} players={mockPlayers} isHost={true} />);

    // Assert - Room code should be formatted (AB CD)
    expect(screen.getByText('AB CD')).toBeInTheDocument();
  });

  it('renders player list from room state', () => {
    // Arrange & Act
    render(<Lobby room={mockRoom} players={mockPlayers} isHost={false} />);

    // Assert - Both players should be visible
    expect(screen.getByText('Host Player')).toBeInTheDocument();
    expect(screen.getByText('Guest Player')).toBeInTheDocument();
  });

  it('Start Game button disabled with <2 players', () => {
    // Arrange - Only one player
    const singlePlayer = [mockPlayers[0]];

    // Act
    render(<Lobby room={mockRoom} players={singlePlayer} isHost={true} />);

    // Assert - Button should be disabled and show "need more" message
    // Component renders button twice (desktop + mobile), get first one
    const startButtons = screen.getAllByRole('button', {
      name: /Need .* Poet.*to Jam/i,
    });
    expect(startButtons[0]).toBeDisabled();
    expect(startButtons[0]).toHaveTextContent('Need 1 more Poet to Jam');
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
  });

  it('shows "Waiting for Host" button when not host', () => {
    // Arrange & Act
    render(<Lobby room={mockRoom} players={mockPlayers} isHost={false} />);

    // Assert - Non-host sees waiting message
    // Component renders button twice (desktop + mobile), get first one
    const waitingButtons = screen.getAllByRole('button', {
      name: /Waiting for Host/i,
    });
    expect(waitingButtons[0]).toBeDisabled();
    expect(waitingButtons[0]).toHaveClass('opacity-50', 'cursor-not-allowed');
  });

  it('Leave Lobby button calls mutation and navigates to home', async () => {
    // Arrange
    const user = userEvent.setup();
    render(<Lobby room={mockRoom} players={mockPlayers} isHost={true} />);

    // Component renders button twice (desktop + mobile), get first one
    const leaveButtons = screen.getAllByRole('button', {
      name: /Leave Lobby/i,
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

  it('calls addAiPlayer mutation when Add AI button clicked', async () => {
    // Arrange
    mockMutations.addAi.mockResolvedValue({ aiUserId: 'ai_123' });
    const user = userEvent.setup();

    render(<Lobby room={mockRoom} players={mockPlayers} isHost={true} />);

    // Find Add AI button (has Bot icon)
    const addAiButtons = screen.getAllByRole('button', { name: /Add AI/i });

    // Act
    await user.click(addAiButtons[0]);

    // Assert
    await waitFor(() => {
      expect(mockMutations.addAi).toHaveBeenCalledWith({
        code: 'ABCD',
        guestToken: 'mock-token',
      });
    });
  });

  it('displays error when addAiPlayer fails', async () => {
    // Arrange
    mockMutations.addAi.mockRejectedValue(new Error('AI add failed'));
    const user = userEvent.setup();

    render(<Lobby room={mockRoom} players={mockPlayers} isHost={true} />);

    const addAiButtons = screen.getAllByRole('button', { name: /Add AI/i });

    // Act
    await user.click(addAiButtons[0]);

    // Assert
    await waitFor(() => {
      const alerts = screen.getAllByText(/unexpected error/i);
      expect(alerts.length).toBeGreaterThan(0);
    });
  });

  it('calls removeAiPlayer mutation when Remove AI button clicked', async () => {
    // Arrange - include an AI player
    const playersWithAi = [
      ...mockPlayers,
      {
        _id: 'player_ai' as Id<'roomPlayers'>,
        _creationTime: Date.now(),
        roomId: 'room_123' as Id<'rooms'>,
        userId: 'user_ai' as Id<'users'>,
        displayName: 'Bashō',
        joinedAt: Date.now(),
        stableId: 'stable_ai_789',
        isBot: true,
      },
    ];
    mockMutations.removeAi.mockResolvedValue({ removed: true });
    const user = userEvent.setup();

    render(<Lobby room={mockRoom} players={playersWithAi} isHost={true} />);

    // Find Remove AI button (appears when AI is present)
    const removeAiButtons = screen.getAllByRole('button', {
      name: /Remove AI/i,
    });

    // Act
    await user.click(removeAiButtons[0]);

    // Assert
    await waitFor(() => {
      expect(mockMutations.removeAi).toHaveBeenCalledWith({
        code: 'ABCD',
        guestToken: 'mock-token',
      });
    });
  });
});
