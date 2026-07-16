// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Mock Convex hooks (external)
const mockUseQuery = vi.fn();
const mockSummonGhostwriter = vi.fn().mockResolvedValue({ summoned: 0 });

vi.mock('convex/react', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: () => mockSummonGhostwriter,
  useConvexAuth: () => ({ isLoading: false, isAuthenticated: false }),
}));

// Mock Clerk (external)
vi.mock('@clerk/nextjs', () => ({
  useUser: () => ({ user: null, isLoaded: true }),
}));

// Mock fetch for guest session API (external boundary)
const mockFetch = vi.fn();
const originalFetch = global.fetch;

// Import after mocking
import { WaitingScreen } from '@/components/WaitingScreen';

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

    render(<WaitingScreen roomCode="ABCD" />);

    // LoadingState shows "Preparing your writing desk..." for LOADING_ROOM
    expect(
      screen.getByText(/Preparing your writing desk/i)
    ).toBeInTheDocument();
  });

  it('skips query when auth is in error and no token is available', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Unable to connect'));
    mockUseQuery.mockReturnValue(undefined);

    render(<WaitingScreen roomCode="ABCD" />);

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

    render(<WaitingScreen roomCode="ABCD" guestToken="prop-token" />);

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

    render(<WaitingScreen roomCode="ABCD" />);

    expect(
      screen.getByText(/Preparing your writing desk/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/Room not found/i)).not.toBeInTheDocument();
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

  it('fills and scrolls its parent frame when embedded after submission', () => {
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
      ],
    });

    render(<WaitingScreen roomCode="ABCD" embedded />);

    const phase = screen.getByTestId('waiting-phase');
    expect(phase).toHaveClass('min-h-0', 'flex-1', 'overflow-y-auto');
    expect(phase).not.toHaveClass('lj-game-viewport');
  });

  it('shows "It\'s around the table now." when not all players submitted', () => {
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

    const heading = screen.getByRole('heading', {
      name: "It's around the table now.",
    });
    expect(heading).toHaveClass('max-w-full', 'break-words');
    expect(heading.parentElement).toHaveClass(
      'w-full',
      'min-w-0',
      'max-w-full'
    );
    expect(screen.getByText(/Round 1 · 1 of 2 ready/i)).toBeInTheDocument();
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

  it('uses progressOverride data and skips the round progress query', () => {
    render(
      <WaitingScreen
        roomCode="ABCD"
        progressOverride={{
          round: 1,
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
        }}
      />
    );

    expect(mockUseQuery).toHaveBeenCalledWith(expect.anything(), 'skip');
    expect(screen.getByText("It's around the table now.")).toBeInTheDocument();
    expect(screen.getByText(/Round 2 · 1 of 2 ready/i)).toBeInTheDocument();
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

  it('names who the room is waiting on (legible without a hover)', () => {
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

    expect(screen.getByText('Waiting on Bob')).toBeInTheDocument();
  });

  it('does not count late spectators as missing round submissions', () => {
    mockUseQuery.mockReturnValue({
      round: 2,
      players: [
        {
          userId: 'user_1',
          stableId: 'stable_1',
          displayName: 'Alice',
          submitted: true,
          isBot: false,
        },
        {
          userId: 'user_late',
          stableId: 'stable_late',
          displayName: 'Late Poet',
          submitted: false,
          isBot: false,
          isSpectator: true,
        },
      ],
    });

    render(<WaitingScreen roomCode="ABCD" />);

    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(
      screen.getByText('Watching this round: Late Poet')
    ).toBeInTheDocument();
    expect(screen.queryByText(/of.*ready/)).not.toBeInTheDocument();
    expect(screen.getByText('watching')).toBeInTheDocument();
  });

  it('offers the host a ghostwriter rescue after overtime', async () => {
    mockUseQuery.mockReturnValue({
      round: 1,
      isHost: true,
      roundStartedAt: 1, // far in the past → deep overtime
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

    const { userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    render(<WaitingScreen roomCode="ABCD" guestToken="mock-token" />);

    const ghostButton = screen.getByRole('button', {
      name: /Summon the ghostwriter/i,
    });
    expect(ghostButton).toBeInTheDocument();

    await user.click(ghostButton);

    await waitFor(() => {
      expect(mockSummonGhostwriter).toHaveBeenCalledWith({
        roomCode: 'ABCD',
        guestToken: 'mock-token',
      });
    });
  });

  it('hides the ghostwriter rescue from non-hosts', () => {
    mockUseQuery.mockReturnValue({
      round: 1,
      isHost: false,
      roundStartedAt: 1,
      players: [
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

    expect(
      screen.queryByRole('button', { name: /Summon the ghostwriter/i })
    ).not.toBeInTheDocument();
  });
});
