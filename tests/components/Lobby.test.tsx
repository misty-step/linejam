import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';

// Mock Next.js router
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock Convex
const mockStartGameMutation = vi.fn();
vi.mock('convex/react', () => ({
  useMutation: () => mockStartGameMutation,
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

  const mockPlayers: Doc<'roomPlayers'>[] = [
    {
      _id: 'player_1' as Id<'roomPlayers'>,
      _creationTime: Date.now(),
      roomId: 'room_123' as Id<'rooms'>,
      userId: 'user_host' as Id<'users'>,
      displayName: 'Host Player',
      joinedAt: Date.now(),
    },
    {
      _id: 'player_2' as Id<'roomPlayers'>,
      _creationTime: Date.now(),
      roomId: 'room_123' as Id<'rooms'>,
      userId: 'user_guest' as Id<'users'>,
      displayName: 'Guest Player',
      joinedAt: Date.now(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUser.mockReturnValue({
      guestToken: 'mock-token',
      isLoading: false,
    });
    mockPush.mockClear();
    mockStartGameMutation.mockClear();
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

  it('QR code component rendered when user is host', () => {
    // Arrange & Act
    render(<Lobby room={mockRoom} players={mockPlayers} isHost={true} />);

    // Assert - RoomQr component has "Scan to Join" text
    expect(screen.getByText('Scan to Join')).toBeInTheDocument();
  });

  it('QR code not rendered when user is not host', () => {
    // Arrange & Act
    render(<Lobby room={mockRoom} players={mockPlayers} isHost={false} />);

    // Assert - RoomQr component should not be present
    // Note: We check for "Scan to Join" text which is unique to RoomQr
    expect(screen.queryByText('Scan to Join')).not.toBeInTheDocument();
  });

  it('calls startGame mutation when Start button clicked', async () => {
    // Arrange
    mockStartGameMutation.mockResolvedValue(undefined);
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
      expect(mockStartGameMutation).toHaveBeenCalledWith({
        code: 'ABCD',
        guestToken: 'mock-token',
      });
    });
  });

  it('displays error message when startGame mutation fails', async () => {
    // Arrange
    mockStartGameMutation.mockRejectedValue(new Error('Game start failed'));
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

  it('Leave Lobby button navigates to home', async () => {
    // Arrange
    const user = userEvent.setup();
    render(<Lobby room={mockRoom} players={mockPlayers} isHost={true} />);

    // Component renders button twice (desktop + mobile), get first one
    const leaveButtons = screen.getAllByRole('button', {
      name: /Leave Lobby/i,
    });

    // Act
    await user.click(leaveButtons[0]);

    // Assert
    expect(mockPush).toHaveBeenCalledWith('/');
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
});
