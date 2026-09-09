// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { cloneElement } from 'react';
import { ConvexProvider } from 'convex/react';
import { createTestConvexClient } from '@/tests/helpers/convexClient';
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
const mockDisablePublicSessionRecapShare = vi.fn();
const mockUseQuery = vi.fn();
const mockConvexClient = Object.assign(createTestConvexClient(), {
  mutation: vi.fn().mockResolvedValue(undefined),
  watchQuery: vi.fn(() => ({
    localQueryResult: () => false,
    onUpdate: () => () => {},
  })),
});

const sessionRecapDependencies: SessionRecapHubDependencies = {
  useEnablePublicShare: () => mockEnablePublicSessionRecapShare,
  useDisablePublicShare: () => mockDisablePublicSessionRecapShare,
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
    }),
    {
      wrapper: ({ children }) => (
        <ConvexProvider client={mockConvexClient}>{children}</ConvexProvider>
      ),
    }
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
    canManageArtifacts: true,
    canContinueRoom: true,
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
    mockDisablePublicSessionRecapShare.mockResolvedValue(null);
    mockUseQuery.mockReturnValue(mockStateNotRevealed);
  });

  it('displays poem status list with reader names', () => {
    renderRevealPhase(<RevealPhase roomCode="ABCD" />);

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('shows a Read chip for revealed poems in the reading circle', () => {
    renderRevealPhase(<RevealPhase roomCode="ABCD" />);

    const bobRow = screen.getByText('Bob').closest('li');
    expect(bobRow?.textContent).toContain('Read');
  });

  it('shows a Reading now chip for the sole unrevealed poem in the reading circle', () => {
    renderRevealPhase(<RevealPhase roomCode="ABCD" />);

    const aliceRow = screen.getByText('Alice').closest('li');
    expect(aliceRow?.textContent).toContain('Reading now');
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

    const annRow = screen.getByText('Ann').closest('li');
    const benRow = screen.getByText('Ben').closest('li');
    const caraRow = screen.getByText('Cara').closest('li');
    const deeRow = screen.getByText('Dee').closest('li');

    expect(annRow?.textContent).toContain('Read');
    expect(benRow?.textContent).toContain('Reading now');
    expect(caraRow?.textContent).toContain('Up next');
    expect(deeRow?.textContent).not.toContain('Read');
    expect(deeRow?.textContent).not.toContain('Reading now');
    expect(deeRow?.textContent).not.toContain('Up next');
  });

  it('displays my poem preview when not revealed', () => {
    renderRevealPhase(<RevealPhase roomCode="ABCD" />);

    expect(
      screen.getByText(/The stars align above/i, { exact: false })
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Five words make this line')
    ).not.toBeInTheDocument();
  });

  it('opens the whole poem and returns to the reading circle after reveal acceptance', async () => {
    const user = userEvent.setup();
    renderRevealPhase(<RevealPhase roomCode="ABCD" />);

    await user.click(screen.getByRole('button', { name: /^Read poem$/i }));

    const poemView = await screen.findByRole('dialog', { name: 'Poem 1' });
    const poemLines = within(poemView).getByRole('list', {
      name: 'Poem lines',
    });
    const visibleLines = within(poemLines).getAllByRole('listitem');
    expect(visibleLines).toHaveLength(mockMyPoem.lines.length);
    mockMyPoem.lines.forEach((line, index) => {
      expect(within(visibleLines[index]).getByText(line.text)).toBeVisible();
    });
    expect(
      within(poemView).getByRole('button', { name: /favorite this poem/i })
    ).toBeEnabled();
    const done = within(poemView).getByRole('button', { name: 'Done' });
    expect(done).toBeEnabled();
    await user.click(done);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /reading circle/i })
    ).toBeVisible();
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
    await user.click(screen.getByRole('button', { name: 'Step in and read' }));

    const poemView = await screen.findByRole('dialog', { name: 'Poem 1' });
    const poemLines = within(poemView).getByRole('list', {
      name: 'Poem lines',
    });
    const visibleLines = within(poemLines).getAllByRole('listitem');
    expect(visibleLines).toHaveLength(mockMyPoem.lines.length);
    mockMyPoem.lines.forEach((line, index) => {
      expect(within(visibleLines[index]).getByText(line.text)).toBeVisible();
    });
    expect(
      within(poemView).getByRole('button', { name: 'Done' })
    ).toBeEnabled();
  });

  it('disables the read action while the reveal is awaiting acceptance', async () => {
    const user = userEvent.setup();
    mockRevealPoemMutation.mockImplementation(() => {
      const { promise, resolve } = Promise.withResolvers<void>();
      setTimeout(resolve, 1000);
      return promise;
    });
    renderRevealPhase(<RevealPhase roomCode="ABCD" />);

    const revealButton = screen.getByRole('button', { name: /^Read poem$/i });
    await user.click(revealButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Opening/i })).toBeDisabled();
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
      screen.getByRole('button', { name: /Share recap/i })
    ).toBeInTheDocument();
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
      screen.getByRole('button', { name: /Play again/i })
    ).toBeInTheDocument();
  });

  it('shows continuation controls to non-hosts too (no stranding)', () => {
    mockUseQuery.mockReturnValue(mockStateAllRevealedNotHost);

    renderRevealPhase(<RevealPhase roomCode="ABCD" />);

    expect(
      screen.getByRole('button', { name: /Back to Lobby/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Play again/i })
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

  it('gives non-hosts replay and share actions after completion', () => {
    mockUseQuery.mockReturnValue(mockStateAllRevealedNotHost);

    renderRevealPhase(<RevealPhase roomCode="ABCD" />);

    expect(
      screen.getByRole('button', { name: /Share recap/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Replay poem 1/i })
    ).toHaveAttribute('href', '/poem/poem_123');
    expect(
      screen.getByRole('button', { name: /Play again/i })
    ).toBeInTheDocument();
  });

  it('shows Exit Room link when all revealed', () => {
    mockUseQuery.mockReturnValue(mockStateAllRevealed);

    renderRevealPhase(<RevealPhase roomCode="ABCD" />);

    const exitLink = screen.getByRole('link', { name: /Exit Room/i });
    expect(exitLink).toBeInTheDocument();
    expect(exitLink).toHaveAttribute('href', '/');
  });

  it('offers a re-read after a poem is revealed', () => {
    mockUseQuery.mockReturnValue({
      ...mockStateNotRevealed,
      myPoem: mockRevealedPoem,
      myPoems: [mockRevealedPoem],
    });

    renderRevealPhase(<RevealPhase roomCode="ABCD" />);

    expect(
      screen.getByRole('button', { name: /Read poem 1 again/i })
    ).toBeInTheDocument();
  });

  it('displays error when reveal mutation fails', async () => {
    mockRevealPoemMutation.mockRejectedValue(new Error('Network error'));
    const user = userEvent.setup();
    renderRevealPhase(<RevealPhase roomCode="ABCD" />);

    const revealButton = screen.getByRole('button', { name: /^Read poem$/i });
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
