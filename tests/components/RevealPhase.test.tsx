// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { cloneElement } from 'react';
import {
  RevealPhase,
  type RevealPhaseDependencies,
} from '@/components/RevealPhase';
import type { SessionRecapHubDependencies } from '@/components/SessionRecapHub';
import type { Id } from '@/convex/_generated/dataModel';

// Mock mutation handlers
const mockRevealPoemMutation = vi.fn();
const mockStartNewCycleMutation = vi.fn();
const mockStartGameMutation = vi.fn();
const mockEnablePublicSessionRecapShare = vi.fn();
const mockUseQuery = vi.fn();

const sessionRecapDependencies: SessionRecapHubDependencies = {
  useEnablePublicShare: () => mockEnablePublicSessionRecapShare,
  useSessionFavorites: () => null,
  trackRoomInviteShared: vi.fn(),
  trackArtifactAction: vi.fn(),
  hashRoomId: () => '0123456789abcdef',
  getRecapUrl: (roomCode) => `/recap/${roomCode}`,
};

const revealPhaseDependencies: RevealPhaseDependencies = {
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
  useRevealState: (args) => mockUseQuery('game:getRevealPhaseState', args),
  useRevealPoem: () => mockRevealPoemMutation,
  useStartNewCycle: () => mockStartNewCycleMutation,
  useStartGame: () => mockStartGameMutation,
  hashRoomId: () => '0123456789abcdef',
  trackGameCompleted: vi.fn(),
  sessionRecapDependencies,
};

function renderRevealPhase(
  ui: React.ReactElement<React.ComponentProps<typeof RevealPhase>>
) {
  return render(
    cloneElement(ui, {
      dependencies: revealPhaseDependencies,
    })
  );
}

describe('RevealPhase component', () => {
  // SAFETY: Synthetic Convex document id fixture for poem tests.
  const mockMyPoem = {
    _id: 'poem_123' as Id<'poems'>,
    indexInRoom: 0,
    createdAt: 1000,
    preview: 'The stars align above',
    readerName: 'Alice',
    readerStableId: 'stable_alice_123',
    isRevealed: false,
    isOwnPoem: true,
    lines: [
      { text: 'One', authorName: 'Alice' },
      { text: 'Two words', authorName: 'Bob' },
      { text: 'Three simple words', authorName: 'Alice' },
      { text: 'Four words in line', authorName: 'Bob' },
      { text: 'Five words make this line', authorName: 'Alice' },
      { text: 'Four words in poem', authorName: 'Bob' },
      { text: 'Three words here', authorName: 'Alice' },
      { text: 'Two words', authorName: 'Bob' },
      { text: 'End', authorName: 'Alice' },
    ],
  };

  const mockRevealedPoem = {
    ...mockMyPoem,
    isRevealed: true,
    revealedAt: 2000,
  };

  const mockStageRevealedPoem = {
    // SAFETY: Synthetic Convex document id fixture for poem tests.
    _id: 'poem_456' as Id<'poems'>,
    indexInRoom: 1,
    createdAt: 1000,
    preview: 'Lanterns drift toward dawn',
    readerName: 'Bob',
    readerStableId: 'stable_bob_456',
    isRevealed: true,
    revealedAt: 3000,
    lines: [
      { text: 'Lanterns', authorName: 'Bob' },
      { text: 'toward dawn', authorName: 'Alice' },
    ],
  };

  const mockPoems = [
    {
      // SAFETY: Synthetic Convex document id fixture for poem tests.
      _id: 'poem_123' as Id<'poems'>,
      indexInRoom: 0,
      createdAt: 1000,
      preview: 'The stars align above',
      readerName: 'Alice',
      readerStableId: 'stable_alice_123',
      isRevealed: false,
    },
    {
      // SAFETY: Synthetic Convex document id fixture for poem tests.
      _id: 'poem_456' as Id<'poems'>,
      indexInRoom: 1,
      createdAt: 1000,
      preview: 'Lanterns drift toward dawn',
      readerName: 'Bob',
      readerStableId: 'stable_bob_456',
      isRevealed: true,
    },
  ];

  const mockPlayers = [
    {
      userId: 'user_alice',
      displayName: 'Alice',
      avatarColor: 'indigo',
    },
    {
      userId: 'user_bob',
      displayName: 'Bob',
      avatarColor: 'teal',
    },
  ];

  const mockStateNotRevealed = {
    status: 'REVEAL' as const,
    isHost: true,
    myPoem: mockMyPoem,
    myPoems: [mockMyPoem],
    poems: mockPoems,
    revealedPoems: [mockStageRevealedPoem],
    revealedCount: 1,
    totalCount: 2,
    allRevealed: false,
    players: mockPlayers,
    roomCode: 'ABCD',
  };

  const mockStateAllRevealed = {
    ...mockStateNotRevealed,
    myPoem: mockRevealedPoem,
    myPoems: [mockRevealedPoem],
    revealedCount: 2,
    allRevealed: true,
    revealedPoems: [mockRevealedPoem, mockStageRevealedPoem],
    poems: [
      { ...mockPoems[0], isRevealed: true },
      { ...mockPoems[1], isRevealed: true },
    ],
  };

  const mockStateAllRevealedNotHost = {
    ...mockStateAllRevealed,
    isHost: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRevealPoemMutation.mockResolvedValue({ revealed: true });
    mockStartNewCycleMutation.mockResolvedValue(undefined);
    mockStartGameMutation.mockResolvedValue(undefined);
    mockEnablePublicSessionRecapShare.mockResolvedValue(null);
    mockUseQuery.mockReturnValue(mockStateNotRevealed);
  });

  it('displays poem status list with reader names', () => {
    renderRevealPhase(<RevealPhase roomCode="ABCD" />);

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('displays loading state while fetching', () => {
    mockUseQuery.mockReturnValue(null);

    renderRevealPhase(<RevealPhase roomCode="ABCD" />);

    expect(screen.getByText(/Unsealing the poems/i)).toBeInTheDocument();
  });

  it('shows a Read chip for revealed poems in the reading circle', () => {
    renderRevealPhase(<RevealPhase roomCode="ABCD" />);

    const bobRow = screen.getByText('Bob').closest('.border-b');
    expect(bobRow?.textContent).toContain('Read');
  });

  it('shows a Reading now chip for the sole unrevealed poem in the reading circle', () => {
    renderRevealPhase(<RevealPhase roomCode="ABCD" />);

    const aliceRow = screen.getByText('Alice').closest('.border-b');
    expect(aliceRow?.textContent).toContain('Reading now');
  });

  it('shows the reading-circle heading and explainer', () => {
    renderRevealPhase(<RevealPhase roomCode="ABCD" />);

    expect(
      screen.getByRole('heading', { name: /The reading circle/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Everyone reads one poem aloud\./i)
    ).toBeInTheDocument();
  });

  it('drives all four reading-circle chip states off reveal order', () => {
    const fourPoems = [
      {
        // SAFETY: Synthetic Convex document id fixture for poem tests.
        _id: 'poem_read' as Id<'poems'>,
        indexInRoom: 0,
        createdAt: 1000,
        preview: 'Already read',
        readerName: 'Ann',
        readerStableId: 'stable_1',
        isRevealed: true,
      },
      {
        // SAFETY: Synthetic Convex document id fixture for poem tests.
        _id: 'poem_now' as Id<'poems'>,
        indexInRoom: 1,
        createdAt: 1000,
        preview: 'Reading currently',
        readerName: 'Ben',
        readerStableId: 'stable_2',
        isRevealed: false,
      },
      {
        // SAFETY: Synthetic Convex document id fixture for poem tests.
        _id: 'poem_next' as Id<'poems'>,
        indexInRoom: 2,
        createdAt: 1000,
        preview: 'On deck',
        readerName: 'Cara',
        readerStableId: 'stable_3',
        isRevealed: false,
      },
      {
        // SAFETY: Synthetic Convex document id fixture for poem tests.
        _id: 'poem_quiet' as Id<'poems'>,
        indexInRoom: 3,
        createdAt: 1000,
        preview: 'Waiting quietly',
        readerName: 'Dee',
        readerStableId: 'stable_4',
        isRevealed: false,
      },
    ];

    mockUseQuery.mockReturnValue({
      ...mockStateNotRevealed,
      myPoems: [],
      poems: fourPoems,
    });

    renderRevealPhase(<RevealPhase roomCode="ABCD" />);

    const annRow = screen.getByText('Ann').closest('.border-b');
    const benRow = screen.getByText('Ben').closest('.border-b');
    const caraRow = screen.getByText('Cara').closest('.border-b');
    const deeRow = screen.getByText('Dee').closest('.border-b');

    expect(annRow?.textContent).toContain('Read');
    expect(benRow?.textContent).toContain('Reading now');
    expect(caraRow?.textContent).toContain('Up next');
    expect(deeRow?.textContent).not.toContain('Read');
    expect(deeRow?.textContent).not.toContain('Reading now');
    expect(deeRow?.textContent).not.toContain('Up next');
  });

  it('displays my poem preview when not revealed', () => {
    renderRevealPhase(<RevealPhase roomCode="ABCD" />);

    expect(screen.getByText(/Your Assignment/i)).toBeInTheDocument();
    expect(
      screen.getByText(/The stars align above/i, { exact: false })
    ).toBeInTheDocument();
  });

  it('shows Reveal & Read button for unrevealed poem', () => {
    renderRevealPhase(<RevealPhase roomCode="ABCD" />);

    expect(
      screen.getByRole('button', { name: /Reveal & Read/i })
    ).toBeInTheDocument();
  });

  it('lets the host open a reveal stage and read the whole assigned poem at once', async () => {
    mockRevealPoemMutation.mockResolvedValue({ revealed: true });
    const user = userEvent.setup();

    renderRevealPhase(<RevealPhase roomCode="ABCD" />);

    await user.click(screen.getByRole('button', { name: /Present reveal/i }));

    const stage = screen.getByTestId('reveal-presentation-stage');
    expect(
      within(stage).getByRole('heading', { name: /Alice reads Poem 01/i })
    ).toBeInTheDocument();
    expect(
      within(stage).getByRole('button', { name: /Reveal on stage/i })
    ).toBeInTheDocument();

    await user.click(
      within(stage).getByRole('button', { name: /Reveal on stage/i })
    );

    await waitFor(() => {
      expect(mockRevealPoemMutation).toHaveBeenCalledWith({
        poemId: 'poem_123',
        guestToken: 'mock-token',
      });
    });

    mockMyPoem.lines.forEach((line) => {
      expect(within(stage).getAllByText(line.text).length).toBeGreaterThan(0);
    });
    expect(
      within(stage).queryByRole('button', { name: /Next line/i })
    ).not.toBeInTheDocument();
    expect(
      within(stage).getByRole('button', { name: /Finish poem/i })
    ).toBeInTheDocument();
  });

  it('keeps reveal presentation mode host-only', () => {
    mockUseQuery.mockReturnValue({
      ...mockStateNotRevealed,
      isHost: false,
    });

    renderRevealPhase(<RevealPhase roomCode="ABCD" />);

    expect(
      screen.queryByRole('button', { name: /Present reveal/i })
    ).not.toBeInTheDocument();
  });

  it('lets the host presentation stage read an already revealed poem when the host has no assigned poem', async () => {
    mockUseQuery.mockReturnValue({
      ...mockStateNotRevealed,
      myPoem: null,
      myPoems: [],
      revealedPoems: [mockStageRevealedPoem],
    });
    const user = userEvent.setup();

    renderRevealPhase(<RevealPhase roomCode="ABCD" />);

    await user.click(screen.getByRole('button', { name: /Present reveal/i }));

    const stage = screen.getByTestId('reveal-presentation-stage');
    expect(
      within(stage).getByRole('button', { name: /Read on stage/i })
    ).toBeInTheDocument();

    await user.click(
      within(stage).getByRole('button', { name: /Read on stage/i })
    );

    expect(within(stage).getByText('Lanterns')).toBeInTheDocument();
    expect(within(stage).getByText('toward dawn')).toBeInTheDocument();
    expect(mockRevealPoemMutation).not.toHaveBeenCalled();
  });

  it('calls revealPoem mutation when Reveal button clicked', async () => {
    mockRevealPoemMutation.mockResolvedValue({ revealed: true });
    const user = userEvent.setup();
    renderRevealPhase(<RevealPhase roomCode="ABCD" />);

    const revealButton = screen.getByRole('button', { name: /Reveal & Read/i });
    await user.click(revealButton);

    await waitFor(() => {
      expect(mockRevealPoemMutation).toHaveBeenCalledWith({
        poemId: 'poem_123',
        guestToken: 'mock-token',
      });
    });
  });

  it('makes an absent reader fallback explicit before revealing', async () => {
    mockRevealPoemMutation.mockResolvedValue({ revealed: true });
    mockUseQuery.mockReturnValue({
      ...mockStateNotRevealed,
      myPoem: {
        ...mockMyPoem,
        readerName: 'Reader Away',
        isFallbackReader: true,
      },
      myPoems: [
        {
          ...mockMyPoem,
          readerName: 'Reader Away',
          isFallbackReader: true,
        },
      ],
    });
    const user = userEvent.setup();

    renderRevealPhase(<RevealPhase roomCode="ABCD" />);

    expect(screen.getByText('Step in for Reader Away')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Step In & Read' }));

    await waitFor(() => {
      expect(mockRevealPoemMutation).toHaveBeenCalledWith({
        poemId: 'poem_123',
        guestToken: 'mock-token',
      });
    });
  });

  it('shows Unsealing... during reveal mutation', async () => {
    const user = userEvent.setup();
    mockRevealPoemMutation.mockImplementation(() => {
      const { promise, resolve } = Promise.withResolvers<void>();
      setTimeout(resolve, 1000);
      return promise;
    });
    renderRevealPhase(<RevealPhase roomCode="ABCD" />);

    const revealButton = screen.getByRole('button', { name: /Reveal & Read/i });
    await user.click(revealButton);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Unsealing/i })
      ).toBeInTheDocument();
    });
  });

  it('shows a session-complete recap hub when all poems are revealed', () => {
    mockUseQuery.mockReturnValue(mockStateAllRevealed);

    renderRevealPhase(<RevealPhase roomCode="ABCD" />);

    expect(
      screen.getByRole('heading', { name: /Session complete/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/2 poems/i)).toBeInTheDocument();
    expect(screen.getByText(/2 poets/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Share the whole set/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /Open Shared Recap/i })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', {
        name: /Replay poem 1: The stars align above/i,
      })
    ).toHaveAttribute('href', '/poem/poem_123');
    expect(
      screen.getByRole('link', {
        name: /Replay poem 2: Lanterns drift toward dawn/i,
      })
    ).toHaveAttribute('href', '/poem/poem_456');
    expect(
      screen.getByRole('button', { name: /Start Next Round/i })
    ).toBeInTheDocument();
  });

  it('shows Back to Lobby button for host when all revealed', () => {
    mockUseQuery.mockReturnValue(mockStateAllRevealed);

    renderRevealPhase(<RevealPhase roomCode="ABCD" />);

    expect(
      screen.getByRole('button', { name: /Back to Lobby/i })
    ).toBeInTheDocument();
  });

  it('shows continuation controls to non-hosts too (no stranding)', () => {
    mockUseQuery.mockReturnValue(mockStateAllRevealedNotHost);

    renderRevealPhase(<RevealPhase roomCode="ABCD" />);

    expect(
      screen.getByRole('button', { name: /Back to Lobby/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Start Next Round/i })
    ).toBeInTheDocument();
  });

  it('calls startNewCycle mutation when Back to Lobby clicked', async () => {
    mockUseQuery.mockReturnValue(mockStateAllRevealed);
    mockStartNewCycleMutation.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderRevealPhase(<RevealPhase roomCode="ABCD" />);

    const newRoundButton = screen.getByRole('button', {
      name: /Back to Lobby/i,
    });
    await user.click(newRoundButton);

    await waitFor(() => {
      expect(mockStartNewCycleMutation).toHaveBeenCalledWith({
        roomCode: 'ABCD',
        guestToken: 'mock-token',
      });
    });
  });

  it('collapses the old second recap link on the session-complete screen', () => {
    mockUseQuery.mockReturnValue(mockStateAllRevealed);

    renderRevealPhase(<RevealPhase roomCode="ABCD" />);

    expect(
      screen.queryByRole('link', { name: /Open Shared Recap/i })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Share the whole set/i })
    ).toBeInTheDocument();
  });

  it('gives non-hosts replay and share actions after completion', () => {
    mockUseQuery.mockReturnValue(mockStateAllRevealedNotHost);

    renderRevealPhase(<RevealPhase roomCode="ABCD" />);

    expect(
      screen.getByRole('button', { name: /Share the whole set/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /Open Shared Recap/i })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Replay poem 1/i })
    ).toHaveAttribute('href', '/poem/poem_123');
    expect(
      screen.getByRole('button', { name: /Start Next Round/i })
    ).toBeInTheDocument();
  });

  it('disables poem replay prefetch on the session-complete screen', () => {
    mockUseQuery.mockReturnValue(mockStateAllRevealed);

    renderRevealPhase(<RevealPhase roomCode="ABCD" />);

    expect(
      screen.getByRole('link', { name: /Replay poem 1/i })
    ).toHaveAttribute('data-prefetch', 'false');
  });

  it('does not show the old archive-only link when all revealed', () => {
    mockUseQuery.mockReturnValue(mockStateAllRevealed);

    renderRevealPhase(<RevealPhase roomCode="ABCD" />);

    expect(screen.queryByRole('link', { name: /^Archive$/i })).toBeNull();
  });

  it('shows Exit Room link when all revealed', () => {
    mockUseQuery.mockReturnValue(mockStateAllRevealed);

    renderRevealPhase(<RevealPhase roomCode="ABCD" />);

    const exitLink = screen.getByRole('link', { name: /Exit Room/i });
    expect(exitLink).toBeInTheDocument();
    expect(exitLink).toHaveAttribute('href', '/');
  });

  it('shows Re-Read My Poem button when poem already revealed', () => {
    mockUseQuery.mockReturnValue({
      ...mockStateNotRevealed,
      myPoem: mockRevealedPoem,
      myPoems: [mockRevealedPoem],
    });

    renderRevealPhase(<RevealPhase roomCode="ABCD" />);

    expect(
      screen.getByRole('button', { name: /Re-Read My Poem/i })
    ).toBeInTheDocument();
  });

  it('displays error when reveal mutation fails', async () => {
    mockRevealPoemMutation.mockRejectedValue(new Error('Network error'));
    const user = userEvent.setup();
    renderRevealPhase(<RevealPhase roomCode="ABCD" />);

    const revealButton = screen.getByRole('button', { name: /Reveal & Read/i });
    await user.click(revealButton);

    await waitFor(() => {
      expect(screen.getByText(/Unable to connect/i)).toBeInTheDocument();
    });
  });

  it('displays error when startNewCycle mutation fails', async () => {
    mockUseQuery.mockReturnValue(mockStateAllRevealed);
    mockStartNewCycleMutation.mockRejectedValue(new Error('Server error'));
    const user = userEvent.setup();
    renderRevealPhase(<RevealPhase roomCode="ABCD" />);

    const newRoundButton = screen.getByRole('button', {
      name: /Back to Lobby/i,
    });
    await user.click(newRoundButton);

    await waitFor(() => {
      expect(screen.getByText(/unexpected error/i)).toBeInTheDocument();
    });
  });
});
