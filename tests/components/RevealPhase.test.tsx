// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';

// Mock Next.js Link (external)
vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    prefetch,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    prefetch?: boolean;
  }) => {
    const prefetchProps =
      prefetch === undefined ? {} : { 'data-prefetch': String(prefetch) };

    return (
      <a href={href} {...prefetchProps} {...props}>
        {children}
      </a>
    );
  },
}));

// Mock Convex hooks (external)
const mockRevealPoemMutation = vi.fn();
const mockStartNewCycleMutation = vi.fn();
const mockStartGameMutation = vi.fn();
const mockEnablePublicSessionRecapShare = vi.fn();
const mockToggleFavorite = vi.fn();
const mockUseQuery = vi.fn();

const mockApiRefs = vi.hoisted(() => ({
  getRevealPhaseState: {},
  revealPoem: {},
  startNewCycle: {},
  startGame: {},
  enablePublicSessionRecapShare: {},
  getSessionFavorites: {},
  isFavorited: {},
  toggleFavorite: {},
}));

vi.mock('@/convex/_generated/api', () => ({
  api: {
    game: {
      getRevealPhaseState: mockApiRefs.getRevealPhaseState,
      revealPoem: mockApiRefs.revealPoem,
      startNewCycle: mockApiRefs.startNewCycle,
      startGame: mockApiRefs.startGame,
    },
    shares: {
      enablePublicSessionRecapShare: mockApiRefs.enablePublicSessionRecapShare,
    },
    favorites: {
      getSessionFavorites: mockApiRefs.getSessionFavorites,
      isFavorited: mockApiRefs.isFavorited,
      toggleFavorite: mockApiRefs.toggleFavorite,
    },
  },
}));

vi.mock('convex/react', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: (mutationRef: unknown) => {
    if (mutationRef === mockApiRefs.revealPoem) return mockRevealPoemMutation;
    if (mutationRef === mockApiRefs.startNewCycle) {
      return mockStartNewCycleMutation;
    }
    if (mutationRef === mockApiRefs.startGame) return mockStartGameMutation;
    if (mutationRef === mockApiRefs.enablePublicSessionRecapShare) {
      return mockEnablePublicSessionRecapShare;
    }
    if (mutationRef === mockApiRefs.toggleFavorite) return mockToggleFavorite;
    throw new Error('Unexpected mutation reference');
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

// Internal modules use real implementations:
// - @/lib/error
// - @/lib/errorFeedback (pure function)

// Import after mocking
import { RevealPhase } from '@/components/RevealPhase';
import { Id } from '@/convex/_generated/dataModel';

describe('RevealPhase component', () => {
  // Mock poem data
  const mockMyPoem = {
    _id: 'poem_123' as Id<'poems'>,
    indexInRoom: 0,
    createdAt: 1000,
    preview: 'The stars align above',
    readerName: 'Alice',
    readerStableId: 'stable_alice_123',
    isRevealed: false,
    isOwnPoem: true,
    isForAi: false,
    lines: [
      { text: 'One', authorName: 'Alice', isBot: false },
      { text: 'Two words', authorName: 'Bob', isBot: false },
      { text: 'Three simple words', authorName: 'Alice', isBot: false },
      { text: 'Four words in line', authorName: 'Bob', isBot: false },
      { text: 'Five words make this line', authorName: 'Alice', isBot: false },
      { text: 'Four words in poem', authorName: 'Bob', isBot: false },
      { text: 'Three words here', authorName: 'Alice', isBot: false },
      { text: 'Two words', authorName: 'Bob', isBot: false },
      { text: 'End', authorName: 'Alice', isBot: false },
    ],
  };

  const mockRevealedPoem = {
    ...mockMyPoem,
    isRevealed: true,
    revealedAt: 2000,
  };

  const mockStageRevealedPoem = {
    _id: 'poem_456' as Id<'poems'>,
    indexInRoom: 1,
    createdAt: 1000,
    preview: 'Lanterns drift toward dawn',
    readerName: 'Bob',
    readerStableId: 'stable_bob_456',
    isRevealed: true,
    revealedAt: 3000,
    lines: [
      { text: 'Lanterns', authorName: 'Bob', isBot: false },
      { text: 'toward dawn', authorName: 'Alice', isBot: false },
    ],
  };

  const mockPoems = [
    {
      _id: 'poem_123' as Id<'poems'>,
      indexInRoom: 0,
      createdAt: 1000,
      preview: 'The stars align above',
      readerName: 'Alice',
      readerStableId: 'stable_alice_123',
      isRevealed: false,
    },
    {
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
      stableId: 'stable_alice_123',
      isBot: false,
    },
    {
      userId: 'user_bob',
      displayName: 'Bob',
      stableId: 'stable_bob_456',
      isBot: false,
    },
  ];

  const mockStateNotRevealed = {
    myPoem: mockMyPoem,
    myPoems: [mockMyPoem],
    revealedPoems: [mockStageRevealedPoem],
    allRevealed: false,
    isHost: true,
    poems: mockPoems,
    players: mockPlayers,
  };

  const mockStateAllRevealed = {
    myPoem: mockRevealedPoem,
    myPoems: [mockRevealedPoem],
    revealedPoems: [mockRevealedPoem, mockStageRevealedPoem],
    allRevealed: true,
    isHost: true,
    poems: mockPoems.map((p) => ({ ...p, isRevealed: true })),
    players: mockPlayers,
  };

  const mockStateAllRevealedNotHost = {
    ...mockStateAllRevealed,
    isHost: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRevealPoemMutation.mockClear();
    mockStartNewCycleMutation.mockClear();
    mockStartGameMutation.mockClear();
    mockEnablePublicSessionRecapShare.mockClear();

    // Default state
    mockUseQuery.mockReturnValue(mockStateNotRevealed);

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

  it('displays loading state while fetching', () => {
    // Arrange
    mockUseQuery.mockReturnValue(null);

    // Act
    render(<RevealPhase roomCode="ABCD" />);

    // Assert
    expect(screen.getByText(/Unsealing the poems/i)).toBeInTheDocument();
  });

  it('displays poem status list with reader names', () => {
    // Arrange & Act
    render(<RevealPhase roomCode="ABCD" />);

    // Assert
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('shows a Read chip for revealed poems in the reading circle', () => {
    // Arrange & Act
    render(<RevealPhase roomCode="ABCD" />);

    // Assert - Bob's poem is revealed, should carry the Read chip. The row
    // is the nearest ancestor carrying the shared row border, since the
    // name sits inside a nested name/poem-label wrapper.
    const bobRow = screen.getByText('Bob').closest('.border-b');
    expect(bobRow?.textContent).toContain('Read');
  });

  it('shows a Reading now chip for the sole unrevealed poem in the reading circle', () => {
    // Arrange & Act
    render(<RevealPhase roomCode="ABCD" />);

    // Assert - Alice's poem is the only unrevealed poem, so it is up now
    const aliceRow = screen.getByText('Alice').closest('.border-b');
    expect(aliceRow?.textContent).toContain('Reading now');
  });

  it('shows the reading-circle heading and explainer', () => {
    render(<RevealPhase roomCode="ABCD" />);

    expect(
      screen.getByRole('heading', { name: /The reading circle/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Everyone reads one poem aloud\./i)
    ).toBeInTheDocument();
  });

  it('drives all four reading-circle chip states off reveal order', () => {
    // Arrange: 4 poems — one read, one reading now, one up next, one quiet.
    // Names deliberately avoid the substring "Read" so the chip assertions
    // below can't accidentally match the reader's own name.
    const fourPoems = [
      {
        _id: 'poem_read' as Id<'poems'>,
        indexInRoom: 0,
        createdAt: 1000,
        preview: 'Already read',
        readerName: 'Ann',
        readerStableId: 'stable_1',
        isRevealed: true,
      },
      {
        _id: 'poem_now' as Id<'poems'>,
        indexInRoom: 1,
        createdAt: 1000,
        preview: 'Reading currently',
        readerName: 'Ben',
        readerStableId: 'stable_2',
        isRevealed: false,
      },
      {
        _id: 'poem_next' as Id<'poems'>,
        indexInRoom: 2,
        createdAt: 1000,
        preview: 'On deck',
        readerName: 'Cara',
        readerStableId: 'stable_3',
        isRevealed: false,
      },
      {
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

    // Act
    render(<RevealPhase roomCode="ABCD" />);

    // Assert
    const annRow = screen.getByText('Ann').closest('.border-b');
    const benRow = screen.getByText('Ben').closest('.border-b');
    const caraRow = screen.getByText('Cara').closest('.border-b');
    const deeRow = screen.getByText('Dee').closest('.border-b');

    expect(annRow?.textContent).toContain('Read');
    expect(benRow?.textContent).toContain('Reading now');
    expect(caraRow?.textContent).toContain('Up next');
    // The quiet row carries no status chip at all.
    expect(deeRow?.textContent).not.toContain('Read');
    expect(deeRow?.textContent).not.toContain('Reading now');
    expect(deeRow?.textContent).not.toContain('Up next');
  });

  it('displays my poem preview when not revealed', () => {
    // Arrange & Act
    render(<RevealPhase roomCode="ABCD" />);

    // Assert
    expect(screen.getByText(/Your Assignment/i)).toBeInTheDocument();
    expect(
      screen.getByText(/The stars align above/i, { exact: false })
    ).toBeInTheDocument();
  });

  it('shows Reveal & Read button for unrevealed poem', () => {
    // Arrange & Act
    render(<RevealPhase roomCode="ABCD" />);

    // Assert
    expect(
      screen.getByRole('button', { name: /Reveal & Read/i })
    ).toBeInTheDocument();
  });

  it('lets the host open a reveal stage and read the whole assigned poem at once', async () => {
    mockRevealPoemMutation.mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<RevealPhase roomCode="ABCD" />);

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

    render(<RevealPhase roomCode="ABCD" />);

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

    render(<RevealPhase roomCode="ABCD" />);

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
    // Arrange
    mockRevealPoemMutation.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<RevealPhase roomCode="ABCD" />);

    // Act
    const revealButton = screen.getByRole('button', { name: /Reveal & Read/i });
    await user.click(revealButton);

    // Assert
    await waitFor(() => {
      expect(mockRevealPoemMutation).toHaveBeenCalledWith({
        poemId: 'poem_123',
        guestToken: 'mock-token',
      });
    });
  });

  it('makes an absent reader fallback explicit before revealing', async () => {
    mockRevealPoemMutation.mockResolvedValue(undefined);
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

    render(<RevealPhase roomCode="ABCD" />);

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
    // Arrange - Make mutation take time
    mockRevealPoemMutation.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 1000))
    );
    const user = userEvent.setup();
    render(<RevealPhase roomCode="ABCD" />);

    // Act
    const revealButton = screen.getByRole('button', { name: /Reveal & Read/i });
    await user.click(revealButton);

    // Assert
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Unsealing/i })
      ).toBeInTheDocument();
    });
  });

  it('shows a session-complete recap hub when all poems are revealed', () => {
    // Arrange
    mockUseQuery.mockReturnValue(mockStateAllRevealed);

    // Act
    render(<RevealPhase roomCode="ABCD" />);

    // Assert
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
    // Arrange
    mockUseQuery.mockReturnValue(mockStateAllRevealed);

    // Act
    render(<RevealPhase roomCode="ABCD" />);

    // Assert
    expect(
      screen.getByRole('button', { name: /Back to Lobby/i })
    ).toBeInTheDocument();
  });

  it('shows continuation controls to non-hosts too (no stranding)', () => {
    // Arrange: a vanished host must never strand the recap
    mockUseQuery.mockReturnValue(mockStateAllRevealedNotHost);

    // Act
    render(<RevealPhase roomCode="ABCD" />);

    // Assert: everyone gets Back to Lobby + Start Next Round
    expect(
      screen.getByRole('button', { name: /Back to Lobby/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Start Next Round/i })
    ).toBeInTheDocument();
  });

  it('calls startNewCycle mutation when Back to Lobby clicked', async () => {
    // Arrange
    mockUseQuery.mockReturnValue(mockStateAllRevealed);
    mockStartNewCycleMutation.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<RevealPhase roomCode="ABCD" />);

    // Act
    const newRoundButton = screen.getByRole('button', {
      name: /Back to Lobby/i,
    });
    await user.click(newRoundButton);

    // Assert
    await waitFor(() => {
      expect(mockStartNewCycleMutation).toHaveBeenCalledWith({
        roomCode: 'ABCD',
        guestToken: 'mock-token',
      });
    });
  });

  it('collapses the old second recap link on the session-complete screen', () => {
    mockUseQuery.mockReturnValue(mockStateAllRevealed);

    render(<RevealPhase roomCode="ABCD" />);

    expect(
      screen.queryByRole('link', { name: /Open Shared Recap/i })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Share the whole set/i })
    ).toBeInTheDocument();
  });

  it('gives non-hosts replay and share actions after completion', () => {
    mockUseQuery.mockReturnValue(mockStateAllRevealedNotHost);

    render(<RevealPhase roomCode="ABCD" />);

    expect(
      screen.getByRole('button', { name: /Share the whole set/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /Open Shared Recap/i })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Replay poem 1/i })
    ).toHaveAttribute('href', '/poem/poem_123');
    // Continuation is open to all participants now, not host-gated
    expect(
      screen.getByRole('button', { name: /Start Next Round/i })
    ).toBeInTheDocument();
  });

  it('disables poem replay prefetch on the session-complete screen', () => {
    mockUseQuery.mockReturnValue(mockStateAllRevealed);

    render(<RevealPhase roomCode="ABCD" />);

    expect(
      screen.getByRole('link', { name: /Replay poem 1/i })
    ).toHaveAttribute('data-prefetch', 'false');
  });

  it('does not show the old archive-only link when all revealed', () => {
    // Arrange
    mockUseQuery.mockReturnValue(mockStateAllRevealed);

    // Act
    render(<RevealPhase roomCode="ABCD" />);

    // Assert
    expect(screen.queryByRole('link', { name: /^Archive$/i })).toBeNull();
  });

  it('shows Exit Room link when all revealed', () => {
    // Arrange
    mockUseQuery.mockReturnValue(mockStateAllRevealed);

    // Act
    render(<RevealPhase roomCode="ABCD" />);

    // Assert
    const exitLink = screen.getByRole('link', { name: /Exit Room/i });
    expect(exitLink).toBeInTheDocument();
    expect(exitLink).toHaveAttribute('href', '/');
  });

  it('shows Re-Read My Poem button when poem already revealed', () => {
    // Arrange - Poem is revealed but not all poems are
    mockUseQuery.mockReturnValue({
      ...mockStateNotRevealed,
      myPoem: mockRevealedPoem,
      myPoems: [mockRevealedPoem],
    });

    // Act
    render(<RevealPhase roomCode="ABCD" />);

    // Assert
    expect(
      screen.getByRole('button', { name: /Re-Read My Poem/i })
    ).toBeInTheDocument();
  });

  it('displays error when reveal mutation fails', async () => {
    // Arrange - "Network error" is transformed by errorToFeedback
    mockRevealPoemMutation.mockRejectedValue(new Error('Network error'));
    const user = userEvent.setup();
    render(<RevealPhase roomCode="ABCD" />);

    // Act
    const revealButton = screen.getByRole('button', { name: /Reveal & Read/i });
    await user.click(revealButton);

    // Assert - Check for user-facing message from real errorToFeedback
    await waitFor(() => {
      expect(screen.getByText(/Unable to connect/i)).toBeInTheDocument();
    });
  });

  it('displays error when startNewCycle mutation fails', async () => {
    // Arrange - Generic error gets user-friendly message from errorToFeedback
    mockUseQuery.mockReturnValue(mockStateAllRevealed);
    mockStartNewCycleMutation.mockRejectedValue(new Error('Server error'));
    const user = userEvent.setup();
    render(<RevealPhase roomCode="ABCD" />);

    // Act
    const newRoundButton = screen.getByRole('button', {
      name: /Back to Lobby/i,
    });
    await user.click(newRoundButton);

    // Assert - Check for user-facing message from real errorToFeedback
    await waitFor(() => {
      expect(screen.getByText(/unexpected error/i)).toBeInTheDocument();
    });
  });

  it('displays AI attribution only for AI-started poems, not all poems', () => {
    // Arrange - User has 2 poems: their own + AI's
    const mockAiPoem = {
      _id: 'poem_ai_789' as Id<'poems'>,
      preview: 'Mountains stand silent',
      isRevealed: false,
      isOwnPoem: false,
      isForAi: true,
      aiPersonaName: 'Bashō',
      lines: [
        { text: 'Mountains', authorName: 'Bashō', isBot: true },
        { text: 'Stand silent', authorName: 'Alice', isBot: false },
        { text: 'In the moonlight', authorName: 'Bashō', isBot: true },
        { text: 'Reflected in the pond', authorName: 'Alice', isBot: false },
        { text: 'Frogs jump from lily pads', authorName: 'Bashō', isBot: true },
        {
          text: 'Ripples spread wide outward',
          authorName: 'Alice',
          isBot: false,
        },
        { text: 'Still waters', authorName: 'Bashō', isBot: true },
        { text: 'Now calm', authorName: 'Alice', isBot: false },
        { text: 'Peace', authorName: 'Bashō', isBot: true },
      ],
    };

    const mockStateWithBothPoems = {
      ...mockStateNotRevealed,
      myPoems: [mockMyPoem, mockAiPoem],
      poems: [
        ...mockPoems,
        {
          _id: 'poem_ai_789' as Id<'poems'>,
          indexInRoom: 2,
          readerName: 'Alice',
          readerStableId: 'stable_alice_123',
          isRevealed: false,
        },
      ],
    };

    mockUseQuery.mockReturnValue(mockStateWithBothPoems);

    // Act
    render(<RevealPhase roomCode="ABCD" />);

    // Assert
    // User's own poem shows standard label
    expect(screen.getByText('Your Assignment')).toBeInTheDocument();

    // AI's poem shows AI attribution
    expect(screen.getByText(/Read for Bashō/i)).toBeInTheDocument();

    // Only ONE poem should have AI attribution (not both)
    const aiLabels = screen.getAllByText(/Read for/i);
    expect(aiLabels).toHaveLength(1);
  });
});
