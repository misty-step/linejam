// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock Convex hooks (external)
const mockUseQuery = vi.fn();
const mockAuthState: {
  clerkUser: null;
  guestId: string;
  guestToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  displayName: string;
  authError: string | null;
} = {
  clerkUser: null,
  guestId: 'guest_123',
  guestToken: 'mock-token',
  isLoading: false,
  isAuthenticated: false,
  displayName: 'Guest',
  authError: null as string | null,
};

vi.mock('convex/react', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

// Mock Clerk (external)
vi.mock('@clerk/nextjs', () => ({
  useUser: () => ({ user: null, isLoaded: true }),
}));

// Mock useUser hook to return pre-loaded state with guestToken
vi.mock('@/lib/auth', () => ({
  useUser: () => mockAuthState,
}));

// Import after mocking
import { WaitingScreen } from '@/components/WaitingScreen';

describe('WaitingScreen component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.authError = null;
    mockAuthState.isLoading = false;
    mockAuthState.guestToken = 'mock-token';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('displays loading state when progress is undefined', () => {
    mockUseQuery.mockReturnValue(undefined);

    render(<WaitingScreen roomCode="ABCD" />);

    // LoadingState shows "Preparing your writing desk..." for LOADING_ROOM
    expect(
      screen.getByText(/Preparing your writing desk/i)
    ).toBeInTheDocument();
  });

  it('skips query when auth is in error and no token is available', () => {
    mockAuthState.authError = 'Unable to connect';
    mockAuthState.guestToken = null;
    mockUseQuery.mockReturnValue(undefined);

    render(<WaitingScreen roomCode="ABCD" />);

    expect(mockUseQuery).toHaveBeenCalledWith(expect.anything(), 'skip');
  });

  it('uses provided token even when auth is in error', () => {
    mockAuthState.authError = 'Unable to connect';
    mockAuthState.guestToken = null;
    mockUseQuery.mockReturnValue(undefined);

    render(<WaitingScreen roomCode="ABCD" guestToken="prop-token" />);

    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        roomCode: 'ABCD',
        guestToken: 'prop-token',
      })
    );
  });

  it('displays error state when progress is null (unauthorized)', () => {
    mockUseQuery.mockReturnValue(null);

    render(<WaitingScreen roomCode="ABCD" />);

    expect(screen.getByText(/Room not found/i)).toBeInTheDocument();
  });

  it('displays round information when progress is available', () => {
    mockUseQuery.mockReturnValue({
      round: 2,
      players: [
        {
          userId: 'user_1',
          stableId: 'stable_1',
          displayName: 'Alice',
          submitted: false,
          isBot: false,
        },
        {
          userId: 'user_2',
          stableId: 'stable_2',
          displayName: 'Bob',
          submitted: false,
          isBot: false,
        },
      ],
    });

    render(<WaitingScreen roomCode="ABCD" />);

    expect(screen.getByText(/Round 3/)).toBeInTheDocument();
  });

  it('shows "Others are writing..." when not all players submitted', () => {
    mockUseQuery.mockReturnValue({
      round: 0,
      players: [
        {
          userId: 'user_1',
          stableId: 'stable_1',
          displayName: 'Alice',
          submitted: true,
          isBot: false,
        },
        {
          userId: 'user_2',
          stableId: 'stable_2',
          displayName: 'Bob',
          submitted: false,
          isBot: false,
        },
      ],
    });

    render(<WaitingScreen roomCode="ABCD" />);

    expect(screen.getByText('Others are writing...')).toBeInTheDocument();
    expect(screen.getByText('1 of 2 ready')).toBeInTheDocument();
  });

  it('shows "Ready" when all players have submitted', () => {
    mockUseQuery.mockReturnValue({
      round: 0,
      players: [
        {
          userId: 'user_1',
          stableId: 'stable_1',
          displayName: 'Alice',
          submitted: true,
          isBot: false,
        },
        {
          userId: 'user_2',
          stableId: 'stable_2',
          displayName: 'Bob',
          submitted: true,
          isBot: false,
        },
      ],
    });

    render(<WaitingScreen roomCode="ABCD" />);

    expect(screen.getByText('Ready')).toBeInTheDocument();
    // Should not show "X of Y ready" when all submitted
    expect(screen.queryByText(/of.*ready/)).not.toBeInTheDocument();
  });

  it('renders player avatars for each player', () => {
    mockUseQuery.mockReturnValue({
      round: 0,
      players: [
        {
          userId: 'user_1',
          stableId: 'stable_1',
          displayName: 'Alice',
          submitted: false,
          isBot: false,
        },
        {
          userId: 'user_2',
          stableId: 'stable_2',
          displayName: 'Bob',
          submitted: true,
          isBot: false,
        },
        {
          userId: 'user_3',
          stableId: 'stable_3',
          displayName: 'Charlie',
          submitted: false,
          isBot: true,
        },
      ],
    });

    render(<WaitingScreen roomCode="ABCD" />);

    // Player names should be in tooltips (rendered in the DOM)
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
  });

  it('shows bot badge for AI players', () => {
    mockUseQuery.mockReturnValue({
      round: 0,
      players: [
        {
          userId: 'user_1',
          stableId: 'stable_1',
          displayName: 'Human',
          submitted: false,
          isBot: false,
        },
        {
          userId: 'bot_1',
          stableId: 'stable_bot',
          displayName: 'Poetry Bot',
          submitted: false,
          isBot: true,
        },
      ],
    });

    render(<WaitingScreen roomCode="ABCD" />);

    // Bot badge should be present (it renders an SVG icon)
    // The BotBadge component with showLabel={false} renders just the icon
    const botBadges = screen.getAllByRole('img', { hidden: true });
    expect(botBadges.length).toBeGreaterThan(0);
  });

  it('applies different styling for submitted vs not-submitted players', () => {
    mockUseQuery.mockReturnValue({
      round: 0,
      players: [
        {
          userId: 'user_1',
          stableId: 'stable_1',
          displayName: 'Submitted',
          submitted: true,
          isBot: false,
        },
        {
          userId: 'user_2',
          stableId: 'stable_2',
          displayName: 'Writing',
          submitted: false,
          isBot: false,
        },
      ],
    });

    const { container } = render(<WaitingScreen roomCode="ABCD" />);

    // Submitted players have opacity-50
    const submittedWrapper = container.querySelector('.opacity-50');
    expect(submittedWrapper).toBeInTheDocument();

    // Not-submitted players have the pulse animation wrapper
    // The structure is: relative wrapper with Avatar + pulse ring div
    const activeWrappers = container.querySelectorAll('.relative');
    expect(activeWrappers.length).toBeGreaterThan(0);
  });

  it('displays strike-through for submitted player names', () => {
    mockUseQuery.mockReturnValue({
      round: 0,
      players: [
        {
          userId: 'user_1',
          stableId: 'stable_1',
          displayName: 'Done',
          submitted: true,
          isBot: false,
        },
      ],
    });

    render(<WaitingScreen roomCode="ABCD" />);

    const playerName = screen.getByText('Done');
    expect(playerName).toHaveClass('line-through');
  });
});
