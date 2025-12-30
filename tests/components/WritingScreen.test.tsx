// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';

// Mock Next.js router (external)
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// Mock Convex hooks (external) - use a mock function we can configure per-test
const mockSubmitLineMutation = vi.fn();
const mockUseQuery = vi.fn();

vi.mock('convex/react', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: () => mockSubmitLineMutation,
}));

// Mock Clerk (external) - let useUser hook use real implementation
vi.mock('@clerk/nextjs', () => ({
  useUser: () => ({ user: null, isLoaded: true }),
}));

// Mock Sentry (external) - let captureError use real implementation
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

// Mock fetch for guest session API (external boundary)
const mockFetch = vi.fn();
const originalFetch = global.fetch;

// Import after mocking
import { WritingScreen } from '@/components/WritingScreen';
import { Id } from '@/convex/_generated/dataModel';

describe('WritingScreen component', () => {
  // Mock assignment data matching the getCurrentAssignment return type
  const mockAssignment = {
    poemId: 'poem_123' as Id<'poems'>,
    lineIndex: 0, // First round, requires 1 word
    targetWordCount: 1,
    previousLineText: null,
  };

  const mockAssignmentRound5 = {
    poemId: 'poem_456' as Id<'poems'>,
    lineIndex: 4, // Fifth round, requires 5 words (peak of diamond)
    targetWordCount: 5,
    previousLineText: 'The moon rises silently tonight',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSubmitLineMutation.mockClear();

    // Default: return assignment for all queries
    // WritingScreen calls useQuery twice but only uses first result for rendering
    mockUseQuery.mockReturnValue(mockAssignment);

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

  it('displays round information correctly', () => {
    // Arrange & Act
    render(<WritingScreen roomCode="ABCD" />);

    // Assert - Round 1 / 9 should be visible
    expect(screen.getByText(/Round 1 \/ 9/)).toBeInTheDocument();
  });

  it('shows textarea with correct aria label for word count', () => {
    // Arrange & Act
    render(<WritingScreen roomCode="ABCD" />);

    // Assert - Textarea should have proper accessibility
    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveAttribute(
      'aria-label',
      'Write your line for round 1. Target: 1 word.'
    );
  });

  it('shows word count validation via WordSlots', () => {
    // Arrange & Act
    render(<WritingScreen roomCode="ABCD" />);

    // Assert - WordSlots shows "words" label and has correct aria-label
    expect(screen.getByText('words')).toBeInTheDocument();
    // Use testId since there are multiple role="status" elements (live region + WordSlots)
    const wordSlots = document.getElementById('word-slots');
    expect(wordSlots).toHaveAttribute('aria-label', '0 of 1 words');
  });

  it('updates word count as user types', async () => {
    // Arrange
    const user = userEvent.setup();
    render(<WritingScreen roomCode="ABCD" />);
    const textarea = screen.getByRole('textbox');

    // Act - Type one word
    await user.type(textarea, 'Hello');

    // Assert - Word count should update (WordSlots aria-label reflects count)
    await waitFor(() => {
      const wordSlots = document.getElementById('word-slots');
      expect(wordSlots).toHaveAttribute('aria-label', '1 of 1 words');
    });
  });

  it('submit button disabled when word count is wrong', () => {
    // Arrange - Assignment requires 1 word, text is empty
    render(<WritingScreen roomCode="ABCD" />);

    // Assert - Button should be disabled
    const submitButton = screen.getByRole('button', {
      name: /Seal Your Line/i,
    });
    expect(submitButton).toBeDisabled();
  });

  it('submit button enabled when word count is correct', async () => {
    // Arrange
    const user = userEvent.setup();
    render(<WritingScreen roomCode="ABCD" />);
    const textarea = screen.getByRole('textbox');

    // Act - Type exactly 1 word
    await user.type(textarea, 'Word');

    // Assert - Button should be enabled
    await waitFor(() => {
      const submitButton = screen.getByRole('button', {
        name: /Seal Your Line/i,
      });
      expect(submitButton).not.toBeDisabled();
    });
  });

  it('displays previous line when available', () => {
    // Arrange - Use assignment with previous line
    mockUseQuery.mockReturnValue(mockAssignmentRound5);

    // Act
    render(<WritingScreen roomCode="ABCD" />);

    // Assert - Previous line should be visible
    expect(
      screen.getByText('The moon rises silently tonight')
    ).toBeInTheDocument();
  });

  it('enforces correct round constraint (diamond pattern: 1,2,3,4,5,4,3,2,1)', async () => {
    // Arrange - Round 5 requires 5 words
    mockUseQuery.mockReturnValue(mockAssignmentRound5);

    const user = userEvent.setup();
    render(<WritingScreen roomCode="ABCD" />);
    const textarea = screen.getByRole('textbox');

    // Act - Type only 3 words (not enough)
    await user.type(textarea, 'One two three');

    // Assert - Button should still be disabled (need 5 words)
    await waitFor(() => {
      const submitButton = screen.getByRole('button', {
        name: /Seal Your Line/i,
      });
      expect(submitButton).toBeDisabled();
    });

    // Act - Add 2 more words
    await user.type(textarea, ' four five');

    // Assert - Now button should be enabled
    await waitFor(() => {
      const submitButton = screen.getByRole('button', {
        name: /Seal Your Line/i,
      });
      expect(submitButton).not.toBeDisabled();
    });
  });

  it('calls submitLine mutation with correct args on submit', async () => {
    // Arrange
    mockSubmitLineMutation.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<WritingScreen roomCode="ABCD" />);
    const textarea = screen.getByRole('textbox');

    // Act - Type valid word and submit
    await user.type(textarea, 'Poetry');
    const submitButton = screen.getByRole('button', {
      name: /Seal Your Line/i,
    });
    await user.click(submitButton);

    // Assert
    await waitFor(() => {
      expect(mockSubmitLineMutation).toHaveBeenCalledWith({
        poemId: 'poem_123',
        lineIndex: 0,
        text: 'Poetry',
        guestToken: 'mock-token',
      });
    });
  });

  it('shows "Sealing..." during submission', async () => {
    // Arrange - Make mutation take time
    mockSubmitLineMutation.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 1000))
    );
    const user = userEvent.setup();
    render(<WritingScreen roomCode="ABCD" />);
    const textarea = screen.getByRole('textbox');

    // Act - Type and submit
    await user.type(textarea, 'Word');
    const submitButton = screen.getByRole('button', {
      name: /Seal Your Line/i,
    });
    await user.click(submitButton);

    // Assert - Button should show submitting state
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Sealing/i })
      ).toBeInTheDocument();
    });
  });

  it('shows confirmation message after successful submit', async () => {
    // Arrange
    mockSubmitLineMutation.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<WritingScreen roomCode="ABCD" />);
    const textarea = screen.getByRole('textbox');

    // Act
    await user.type(textarea, 'Beautiful');
    const submitButton = screen.getByRole('button', {
      name: /Seal Your Line/i,
    });
    await user.click(submitButton);

    // Assert - Should show confirmation (uses curly quotes in component)
    await waitFor(() => {
      expect(screen.getByText(/Your Line Submitted/i)).toBeInTheDocument();
      // Confirmation text is rendered inside a paragraph with curly quotes
      expect(screen.getByText(/\u201cBeautiful\u201d/)).toBeInTheDocument();
    });
  });

  it('shows error message when submission fails', async () => {
    // Arrange
    mockSubmitLineMutation.mockRejectedValue(new Error('Network error'));
    const user = userEvent.setup();
    render(<WritingScreen roomCode="ABCD" />);
    const textarea = screen.getByRole('textbox');

    // Act
    await user.type(textarea, 'Verse');
    const submitButton = screen.getByRole('button', {
      name: /Seal Your Line/i,
    });
    await user.click(submitButton);

    // Assert - Error should appear
    await waitFor(() => {
      expect(screen.getByText(/Failed to submit line/i)).toBeInTheDocument();
    });
  });

  it('renders WaitingScreen when no assignment', () => {
    // Arrange - No assignment available, return progress for WaitingScreen
    mockUseQuery
      .mockReturnValueOnce(null) // getCurrentAssignment returns null
      .mockReturnValue({ round: 0, players: [] }); // getRoundProgress for WaitingScreen

    // Act
    render(<WritingScreen roomCode="ABCD" />);

    // Assert - Should show waiting screen content
    // WaitingScreen shows "Ready" or "Others are writing..."
    expect(screen.getByText(/Ready|Others are writing/i)).toBeInTheDocument();
  });

  it('textarea has aria-invalid when word count is wrong', () => {
    // Arrange & Act - Empty textarea with target of 1 word
    render(<WritingScreen roomCode="ABCD" />);
    const textarea = screen.getByRole('textbox');

    // Assert
    expect(textarea).toHaveAttribute('aria-invalid', 'true');
  });

  it('textarea has aria-invalid=false when word count is correct', async () => {
    // Arrange
    const user = userEvent.setup();
    render(<WritingScreen roomCode="ABCD" />);
    const textarea = screen.getByRole('textbox');

    // Act - Type exactly 1 word
    await user.type(textarea, 'Perfect');

    // Assert
    await waitFor(() => {
      expect(textarea).toHaveAttribute('aria-invalid', 'false');
    });
  });

  describe('placeholder text', () => {
    it('shows "write one word…" for round 1 (singular)', () => {
      // Arrange - Round 1 requires 1 word
      mockUseQuery.mockReturnValue({
        ...mockAssignment,
        lineIndex: 0,
        targetWordCount: 1,
      });

      // Act
      render(<WritingScreen roomCode="ABCD" />);
      const textarea = screen.getByRole('textbox');

      // Assert
      expect(textarea).toHaveAttribute('placeholder', 'write one word…');
    });

    it('shows "write two words…" for round 2 (plural)', () => {
      // Arrange - Round 2 requires 2 words
      mockUseQuery.mockReturnValue({
        ...mockAssignment,
        lineIndex: 1,
        targetWordCount: 2,
      });

      // Act
      render(<WritingScreen roomCode="ABCD" />);
      const textarea = screen.getByRole('textbox');

      // Assert
      expect(textarea).toHaveAttribute('placeholder', 'write two words…');
    });

    it('shows "write five words…" for round 5 (peak of diamond)', () => {
      // Arrange - Round 5 requires 5 words
      mockUseQuery.mockReturnValue(mockAssignmentRound5);

      // Act
      render(<WritingScreen roomCode="ABCD" />);
      const textarea = screen.getByRole('textbox');

      // Assert
      expect(textarea).toHaveAttribute('placeholder', 'write five words…');
    });

    it('shows "write three words…" for round 3', () => {
      // Arrange - Round 3 requires 3 words
      mockUseQuery.mockReturnValue({
        ...mockAssignment,
        lineIndex: 2,
        targetWordCount: 3,
      });

      // Act
      render(<WritingScreen roomCode="ABCD" />);
      const textarea = screen.getByRole('textbox');

      // Assert
      expect(textarea).toHaveAttribute('placeholder', 'write three words…');
    });

    it('shows "write four words…" for round 4', () => {
      // Arrange - Round 4 requires 4 words
      mockUseQuery.mockReturnValue({
        ...mockAssignment,
        lineIndex: 3,
        targetWordCount: 4,
      });

      // Act
      render(<WritingScreen roomCode="ABCD" />);
      const textarea = screen.getByRole('textbox');

      // Assert
      expect(textarea).toHaveAttribute('placeholder', 'write four words…');
    });
  });
});
