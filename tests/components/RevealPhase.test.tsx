import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';

// Mock Next.js Link
vi.mock('next/link', () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

// Mock Convex hooks
const mockRevealPoemMutation = vi.fn();
const mockStartNewCycleMutation = vi.fn();
const mockUseQuery = vi.fn();

// Track which mutation is requested by call order (revealPoem is called first, startNewCycle second)
let mutationCallCount = 0;
vi.mock('convex/react', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: () => {
    mutationCallCount++;
    // RevealPhase component calls useMutation twice:
    // 1. revealPoemMutation (line 48)
    // 2. startNewCycleMutation (line 50)
    if (mutationCallCount % 2 === 1) return mockRevealPoemMutation;
    return mockStartNewCycleMutation;
  },
}));

// Mock auth hook
const mockUseUser = vi.fn();
vi.mock('@/lib/auth', () => ({
  useUser: () => mockUseUser(),
}));

// Mock error utilities
vi.mock('@/lib/error', () => ({
  captureError: vi.fn(),
}));

vi.mock('@/lib/errorFeedback', () => ({
  errorToFeedback: (err: Error) => ({
    message: err.message || 'An unexpected error occurred',
    variant: 'error',
  }),
}));

// Import after mocking
import { RevealPhase } from '@/components/RevealPhase';
import { Id } from '@/convex/_generated/dataModel';

describe('RevealPhase component', () => {
  // Mock poem data
  const mockMyPoem = {
    _id: 'poem_123' as Id<'poems'>,
    preview: 'The stars align above',
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
  };

  const mockPoems = [
    {
      _id: 'poem_123' as Id<'poems'>,
      indexInRoom: 0,
      readerName: 'Alice',
      readerStableId: 'stable_alice_123',
      isRevealed: false,
    },
    {
      _id: 'poem_456' as Id<'poems'>,
      indexInRoom: 1,
      readerName: 'Bob',
      readerStableId: 'stable_bob_456',
      isRevealed: true,
    },
  ];

  const mockStateNotRevealed = {
    myPoem: mockMyPoem,
    myPoems: [mockMyPoem],
    allRevealed: false,
    isHost: true,
    poems: mockPoems,
  };

  const mockStateAllRevealed = {
    myPoem: mockRevealedPoem,
    myPoems: [mockRevealedPoem],
    allRevealed: true,
    isHost: true,
    poems: mockPoems.map((p) => ({ ...p, isRevealed: true })),
  };

  const mockStateAllRevealedNotHost = {
    ...mockStateAllRevealed,
    isHost: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mutationCallCount = 0; // Reset mutation counter
    mockUseUser.mockReturnValue({
      guestToken: 'mock-token',
      isLoading: false,
    });
    mockRevealPoemMutation.mockClear();
    mockStartNewCycleMutation.mockClear();

    // Default state
    mockUseQuery.mockReturnValue(mockStateNotRevealed);
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

  it('shows revealed status with checkmark for revealed poems', () => {
    // Arrange & Act
    render(<RevealPhase roomCode="ABCD" />);

    // Assert - Bob's poem is revealed, should have checkmark
    const bobRow = screen.getByText('Bob').closest('div');
    expect(bobRow?.parentElement?.textContent).toContain('✓');
  });

  it('shows unrevealed status with dot for unrevealed poems', () => {
    // Arrange & Act
    render(<RevealPhase roomCode="ABCD" />);

    // Assert - Alice's poem is not revealed, should have dot
    const aliceRow = screen.getByText('Alice').closest('div');
    expect(aliceRow?.parentElement?.textContent).toContain('·');
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

  it('displays Session Complete when all revealed', () => {
    // Arrange
    mockUseQuery.mockReturnValue(mockStateAllRevealed);

    // Act
    render(<RevealPhase roomCode="ABCD" />);

    // Assert
    expect(screen.getByText(/Session/i)).toBeInTheDocument();
    expect(screen.getByText(/Complete/i)).toBeInTheDocument();
  });

  it('shows New Round button for host when all revealed', () => {
    // Arrange
    mockUseQuery.mockReturnValue(mockStateAllRevealed);

    // Act
    render(<RevealPhase roomCode="ABCD" />);

    // Assert
    expect(
      screen.getByRole('button', { name: /New Round/i })
    ).toBeInTheDocument();
  });

  it('does not show New Round button for non-host', () => {
    // Arrange
    mockUseQuery.mockReturnValue(mockStateAllRevealedNotHost);

    // Act
    render(<RevealPhase roomCode="ABCD" />);

    // Assert
    expect(
      screen.queryByRole('button', { name: /New Round/i })
    ).not.toBeInTheDocument();
  });

  it('calls startNewCycle mutation when New Round clicked', async () => {
    // Arrange
    mockUseQuery.mockReturnValue(mockStateAllRevealed);
    mockStartNewCycleMutation.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<RevealPhase roomCode="ABCD" />);

    // Act
    const newRoundButton = screen.getByRole('button', { name: /New Round/i });
    await user.click(newRoundButton);

    // Assert
    await waitFor(() => {
      expect(mockStartNewCycleMutation).toHaveBeenCalledWith({
        roomCode: 'ABCD',
        guestToken: 'mock-token',
      });
    });
  });

  it('shows Archive link when all revealed', () => {
    // Arrange
    mockUseQuery.mockReturnValue(mockStateAllRevealed);

    // Act
    render(<RevealPhase roomCode="ABCD" />);

    // Assert
    const archiveLink = screen.getByRole('link', { name: /Archive/i });
    expect(archiveLink).toBeInTheDocument();
    expect(archiveLink).toHaveAttribute('href', '/me/poems');
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
    // Arrange
    mockRevealPoemMutation.mockRejectedValue(new Error('Network error'));
    const user = userEvent.setup();
    render(<RevealPhase roomCode="ABCD" />);

    // Act
    const revealButton = screen.getByRole('button', { name: /Reveal & Read/i });
    await user.click(revealButton);

    // Assert
    await waitFor(() => {
      expect(screen.getByText(/Network error/i)).toBeInTheDocument();
    });
  });

  it('displays error when startNewCycle mutation fails', async () => {
    // Arrange
    mockUseQuery.mockReturnValue(mockStateAllRevealed);
    mockStartNewCycleMutation.mockRejectedValue(new Error('Cycle error'));
    const user = userEvent.setup();
    render(<RevealPhase roomCode="ABCD" />);

    // Act
    const newRoundButton = screen.getByRole('button', { name: /New Round/i });
    await user.click(newRoundButton);

    // Assert
    await waitFor(() => {
      expect(screen.getByText(/Cycle error/i)).toBeInTheDocument();
    });
  });

  it('shows QR code when all revealed for inviting to next cycle', () => {
    // Arrange
    mockUseQuery.mockReturnValue(mockStateAllRevealed);

    // Act
    render(<RevealPhase roomCode="ABCD" />);

    // Assert - RoomQr shows "Scan to Join" text
    expect(screen.getByText(/Invite for Next Cycle/i)).toBeInTheDocument();
    expect(screen.getByText(/Scan to Join/i)).toBeInTheDocument();
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
