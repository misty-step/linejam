// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';

// Mock external dependencies only
vi.mock('convex/react', () => ({
  useMutation: () => vi.fn().mockResolvedValue(undefined),
}));

// Mock browser clipboard API (external boundary)
const mockClipboard = {
  writeText: vi.fn().mockResolvedValue(undefined),
};
Object.defineProperty(navigator, 'clipboard', {
  value: mockClipboard,
  configurable: true,
});

// Mock Sentry (external library)
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  withScope: vi.fn((cb) => cb({ setExtra: vi.fn() })),
}));

// Import after mocking - these use REAL implementations
import { PoemDisplay, type PoemLine } from '@/components/PoemDisplay';
import { Id } from '@/convex/_generated/dataModel';
import { getUserColor, getUniqueColor } from '@/lib/avatarColor';

describe('PoemDisplay component', () => {
  const mockPoemId = 'poem_test_123' as Id<'poems'>;
  const mockOnDone = vi.fn();

  const mockLines: PoemLine[] = [
    { text: 'One', authorName: 'Alice', authorStableId: 'stable_alice' },
    { text: 'Two words', authorName: 'Bob', authorStableId: 'stable_bob' },
    {
      text: 'Three simple words',
      authorName: 'Alice',
      authorStableId: 'stable_alice',
    },
    {
      text: 'Four words in line',
      authorName: 'Bob',
      authorStableId: 'stable_bob',
    },
    {
      text: 'Five words make this line',
      authorName: 'Alice',
      authorStableId: 'stable_alice',
    },
    {
      text: 'Four words in poem',
      authorName: 'Bob',
      authorStableId: 'stable_bob',
    },
    {
      text: 'Three words here',
      authorName: 'Alice',
      authorStableId: 'stable_alice',
    },
    { text: 'Two words', authorName: 'Bob', authorStableId: 'stable_bob' },
    { text: 'End', authorName: 'Alice', authorStableId: 'stable_alice' },
  ];

  const allStableIds = ['stable_alice', 'stable_bob'];

  beforeEach(() => {
    vi.clearAllMocks();
    mockClipboard.writeText.mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('reveal animation', () => {
    it('starts with no lines revealed when alreadyRevealed is false', () => {
      render(
        <PoemDisplay
          poemId={mockPoemId}
          lines={mockLines}
          onDone={mockOnDone}
          alreadyRevealed={false}
        />
      );

      // Lines should have opacity-0 initially (not revealed)
      const lineDots = screen.getAllByRole('button', { name: /Show author/i });
      expect(lineDots[0]).toHaveClass('opacity-0');
    });

    it('reveals all lines immediately when alreadyRevealed is true', () => {
      render(
        <PoemDisplay
          poemId={mockPoemId}
          lines={mockLines}
          onDone={mockOnDone}
          alreadyRevealed={true}
        />
      );

      // All lines should be visible immediately
      const lineDots = screen.getAllByRole('button', { name: /Show author/i });
      lineDots.forEach((dot) => {
        expect(dot).toHaveClass('opacity-100');
      });
    });

    it('reveals lines progressively with staggered timing', async () => {
      render(
        <PoemDisplay
          poemId={mockPoemId}
          lines={mockLines}
          onDone={mockOnDone}
          alreadyRevealed={false}
        />
      );

      const lineDots = screen.getAllByRole('button', { name: /Show author/i });

      // Initially no lines revealed
      expect(lineDots[0]).toHaveClass('opacity-0');

      // After 1000ms (BASE_REVEAL_DELAY), first line should reveal
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
      expect(lineDots[0]).toHaveClass('opacity-100');
      expect(lineDots[1]).toHaveClass('opacity-0');

      // After another 1000ms, second line reveals
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
      expect(lineDots[1]).toHaveClass('opacity-100');
    });

    it('pauses after line 4 with extra delay', async () => {
      render(
        <PoemDisplay
          poemId={mockPoemId}
          lines={mockLines}
          onDone={mockOnDone}
          alreadyRevealed={false}
        />
      );

      // Advance timers to reveal first 5 lines (0-4)
      for (let i = 0; i < 5; i++) {
        await act(async () => {
          vi.advanceTimersByTime(1000);
        });
      }

      const lineDots = screen.getAllByRole('button', { name: /Show author/i });

      // Lines 0-4 should be revealed
      expect(lineDots[4]).toHaveClass('opacity-100');
      expect(lineDots[5]).toHaveClass('opacity-0');

      // Line 5 (after pause point at PAUSE_AFTER_LINE=4) needs extra PAUSE_DURATION
      await act(async () => {
        vi.advanceTimersByTime(1000); // Normal delay - not enough
      });
      expect(lineDots[5]).toHaveClass('opacity-0');

      await act(async () => {
        vi.advanceTimersByTime(1200); // Extra pause delay
      });
      expect(lineDots[5]).toHaveClass('opacity-100');
    });

    it('shows Share and Close buttons only after all lines revealed', async () => {
      render(
        <PoemDisplay
          poemId={mockPoemId}
          lines={mockLines}
          onDone={mockOnDone}
          alreadyRevealed={false}
        />
      );

      // Initially footer should be hidden (opacity-0 pointer-events-none)
      const shareButton = screen.getByRole('button', { name: /Share/i });
      expect(shareButton.parentElement).toHaveClass('opacity-0');

      // Reveal all 9 lines one by one (with extra pause after line 4)
      for (let i = 0; i < 9; i++) {
        const delay = i === 5 ? 2200 : 1000; // Extra delay after pause point
        await act(async () => {
          vi.advanceTimersByTime(delay);
        });
      }

      // Footer should now be visible
      expect(shareButton.parentElement).toHaveClass('opacity-100');
    });
  });

  describe('author interaction', () => {
    it('shows author name on dot click', async () => {
      render(
        <PoemDisplay
          poemId={mockPoemId}
          lines={mockLines}
          onDone={mockOnDone}
          alreadyRevealed={true}
        />
      );

      const firstDot = screen.getAllByRole('button', {
        name: /Show author/i,
      })[0];

      // Click to show author
      await act(async () => {
        fireEvent.click(firstDot);
      });

      // Author byline should be visible (first Alice)
      const aliceBylines = screen.getAllByText(/— Alice/i);
      expect(aliceBylines[0]).toHaveClass('opacity-100');
    });

    it('hides author name after 2 seconds', async () => {
      render(
        <PoemDisplay
          poemId={mockPoemId}
          lines={mockLines}
          onDone={mockOnDone}
          alreadyRevealed={true}
        />
      );

      const firstDot = screen.getAllByRole('button', {
        name: /Show author/i,
      })[0];

      // Click to show author
      await act(async () => {
        fireEvent.click(firstDot);
      });

      // Author should be visible
      const aliceBylines = screen.getAllByText(/— Alice/i);
      expect(aliceBylines[0]).toHaveClass('opacity-100');

      // After 2 seconds, author should hide
      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      expect(aliceBylines[0]).toHaveClass('opacity-0');
    });

    it('triggers selection on Enter key', async () => {
      render(
        <PoemDisplay
          poemId={mockPoemId}
          lines={mockLines}
          onDone={mockOnDone}
          alreadyRevealed={true}
        />
      );

      const firstDot = screen.getAllByRole('button', {
        name: /Show author/i,
      })[0];

      // Simulate Enter key
      await act(async () => {
        fireEvent.keyDown(firstDot, { key: 'Enter' });
      });

      // Author should be visible
      const aliceBylines = screen.getAllByText(/— Alice/i);
      expect(aliceBylines[0]).toHaveClass('opacity-100');
    });

    it('triggers selection on Space key', async () => {
      render(
        <PoemDisplay
          poemId={mockPoemId}
          lines={mockLines}
          onDone={mockOnDone}
          alreadyRevealed={true}
        />
      );

      const firstDot = screen.getAllByRole('button', {
        name: /Show author/i,
      })[0];

      // Simulate Space key
      await act(async () => {
        fireEvent.keyDown(firstDot, { key: ' ' });
      });

      // Author should be visible
      const aliceBylines = screen.getAllByText(/— Alice/i);
      expect(aliceBylines[0]).toHaveClass('opacity-100');
    });

    it('shows AI indicator for bot authors', () => {
      const linesWithBot: PoemLine[] = [
        {
          text: 'One',
          authorName: 'Bashō',
          authorStableId: 'stable_basho',
          isBot: true,
        },
      ];

      render(
        <PoemDisplay
          poemId={mockPoemId}
          lines={linesWithBot}
          onDone={mockOnDone}
          alreadyRevealed={true}
        />
      );

      const dot = screen.getByRole('button', { name: /Show author/i });
      fireEvent.click(dot);

      expect(screen.getByText(/— Bashō/i)).toBeInTheDocument();
      expect(screen.getByText(/\(AI\)/i)).toBeInTheDocument();
    });
  });

  describe('author color logic', () => {
    it('uses getUniqueColor when allStableIds provided', () => {
      render(
        <PoemDisplay
          poemId={mockPoemId}
          lines={mockLines}
          onDone={mockOnDone}
          alreadyRevealed={true}
          allStableIds={allStableIds}
        />
      );

      // Verify actual colors are rendered (using real getUniqueColor)
      const expectedAliceColor = getUniqueColor('stable_alice', allStableIds);
      const expectedBobColor = getUniqueColor('stable_bob', allStableIds);

      const dots = screen.getAllByRole('button', { name: /Show author/i });
      // First dot is Alice
      expect(dots[0]).toHaveStyle({ backgroundColor: expectedAliceColor });
      // Second dot is Bob
      expect(dots[1]).toHaveStyle({ backgroundColor: expectedBobColor });
    });

    it('uses getUserColor when only authorStableId provided (no allStableIds)', () => {
      render(
        <PoemDisplay
          poemId={mockPoemId}
          lines={mockLines}
          onDone={mockOnDone}
          alreadyRevealed={true}
          // No allStableIds prop
        />
      );

      // Verify actual colors are rendered (using real getUserColor)
      const expectedAliceColor = getUserColor('stable_alice');
      const expectedBobColor = getUserColor('stable_bob');

      const dots = screen.getAllByRole('button', { name: /Show author/i });
      expect(dots[0]).toHaveStyle({ backgroundColor: expectedAliceColor });
      expect(dots[1]).toHaveStyle({ backgroundColor: expectedBobColor });
    });

    it('uses muted color when no authorStableId', () => {
      const linesWithoutStableId: PoemLine[] = [
        { text: 'Anonymous line', authorName: 'Unknown' },
      ];

      render(
        <PoemDisplay
          poemId={mockPoemId}
          lines={linesWithoutStableId}
          onDone={mockOnDone}
          alreadyRevealed={true}
        />
      );

      // Check style attribute directly (toHaveStyle doesn't resolve CSS vars in happy-dom)
      const dot = screen.getByRole('button', { name: /Show author/i });
      expect(dot.getAttribute('style')).toContain('var(--color-text-muted)');
    });
  });

  describe('actions', () => {
    it('copies URL to clipboard when Share button clicked', async () => {
      render(
        <PoemDisplay
          poemId={mockPoemId}
          lines={mockLines}
          onDone={mockOnDone}
          alreadyRevealed={true}
        />
      );

      const shareButton = screen.getByRole('button', { name: /Share/i });
      await act(async () => {
        fireEvent.click(shareButton);
      });

      // Verify clipboard was called with the share URL
      expect(mockClipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('/poem/poem_test_123')
      );
    });

    it('calls onDone when Close button clicked', async () => {
      render(
        <PoemDisplay
          poemId={mockPoemId}
          lines={mockLines}
          onDone={mockOnDone}
          alreadyRevealed={true}
        />
      );

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Close/i }));
      });
      expect(mockOnDone).toHaveBeenCalled();
    });
  });

  describe('string line normalization', () => {
    it('handles plain string lines array', () => {
      const stringLines = ['One', 'Two words', 'Three simple words'];

      render(
        <PoemDisplay
          poemId={mockPoemId}
          lines={stringLines}
          onDone={mockOnDone}
          alreadyRevealed={true}
        />
      );

      expect(screen.getByText('One')).toBeInTheDocument();
      expect(screen.getByText('Two words')).toBeInTheDocument();
      expect(screen.getByText('Three simple words')).toBeInTheDocument();
    });
  });
});
