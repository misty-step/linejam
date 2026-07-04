// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';

// Mock external dependencies only
vi.mock('convex/react', () => ({
  useMutation: () => vi.fn().mockResolvedValue(undefined),
  useQuery: () => false, // isFavorited → not favorited
}));

// Mock browser clipboard API (external boundary)
const mockClipboard = {
  writeText: vi.fn().mockResolvedValue(undefined),
};
Object.defineProperty(navigator, 'clipboard', {
  value: mockClipboard,
  configurable: true,
});

// Import after mocking - these use REAL implementations
import { PoemDisplay, type PoemLine } from '@/components/PoemDisplay';
import { Id } from '@/convex/_generated/dataModel';
import { getUserColor, getUniqueColor } from '@/lib/avatarColor';
import { installMatchMedia } from '@/tests/helpers/matchMedia';

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
    localStorage.clear();
    mockClipboard.writeText.mockClear();
    installMatchMedia(false);
    Object.defineProperty(navigator, 'vibrate', {
      value: vi.fn(),
      configurable: true,
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
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

    it('reveals lines with the poem-shaped ceremony cadence', async () => {
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

      // The reveal is not a flat metronome: it follows the poem diamond,
      // swelling toward the five-word line before accelerating to the end.
      await act(async () => {
        vi.advanceTimersByTime(559);
      });
      expect(lineDots[0]).toHaveClass('opacity-0');

      await act(async () => {
        vi.advanceTimersByTime(1);
      });
      expect(lineDots[0]).toHaveClass('opacity-100');
      expect(lineDots[1]).toHaveClass('opacity-0');
      expect(navigator.vibrate).toHaveBeenCalledWith(8);

      await act(async () => {
        vi.advanceTimersByTime(680);
      });
      expect(lineDots[1]).toHaveClass('opacity-100');
    });

    it('crescendoes into the final line instead of pausing at a fixed beat', async () => {
      render(
        <PoemDisplay
          poemId={mockPoemId}
          lines={mockLines}
          onDone={mockOnDone}
          alreadyRevealed={false}
        />
      );

      const lineDots = screen.getAllByRole('button', { name: /Show author/i });
      const delays = [560, 680, 800, 940, 1120, 900, 720, 520, 360];

      for (const delay of delays.slice(0, 5)) {
        await act(async () => {
          vi.advanceTimersByTime(delay);
        });
      }

      expect(lineDots[4]).toHaveClass('opacity-100');
      expect(lineDots[5]).toHaveClass('opacity-0');

      await act(async () => {
        vi.advanceTimersByTime(899);
      });
      expect(lineDots[5]).toHaveClass('opacity-0');

      await act(async () => {
        vi.advanceTimersByTime(1);
      });
      expect(lineDots[5]).toHaveClass('opacity-100');

      for (const delay of delays.slice(6, 8)) {
        await act(async () => {
          vi.advanceTimersByTime(delay);
        });
      }

      expect(lineDots[7]).toHaveClass('opacity-100');
      expect(lineDots[8]).toHaveClass('opacity-0');

      await act(async () => {
        vi.advanceTimersByTime(359);
      });
      expect(lineDots[8]).toHaveClass('opacity-0');

      await act(async () => {
        vi.advanceTimersByTime(1);
      });
      expect(lineDots[8]).toHaveClass('opacity-100');
      expect(navigator.vibrate).toHaveBeenLastCalledWith([14, 30, 18]);
    });

    it('reveals immediately and skips haptics for reduced motion', async () => {
      installMatchMedia(true);

      render(
        <PoemDisplay
          poemId={mockPoemId}
          lines={mockLines}
          onDone={mockOnDone}
          alreadyRevealed={false}
        />
      );

      const lineDots = screen.getAllByRole('button', { name: /Show author/i });
      lineDots.forEach((dot) => {
        expect(dot).toHaveClass('opacity-100');
      });
      expect(navigator.vibrate).not.toHaveBeenCalled();
    });

    it('lets the reader mute reveal punctuation before the first line', async () => {
      render(
        <PoemDisplay
          poemId={mockPoemId}
          lines={mockLines}
          onDone={mockOnDone}
          alreadyRevealed={false}
        />
      );

      fireEvent.click(
        screen.getByRole('button', { name: /Mute ceremony sound/i })
      );

      await act(async () => {
        vi.advanceTimersByTime(560);
      });

      expect(navigator.vibrate).not.toHaveBeenCalled();
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
      expect(screen.getByTestId('poem-actions')).toHaveClass('opacity-0');

      // Reveal all 9 lines one by one (with extra pause after line 4)
      for (const delay of [560, 680, 800, 940, 1120, 900, 720, 520, 360]) {
        await act(async () => {
          vi.advanceTimersByTime(delay);
        });
      }

      // Footer should now be visible
      expect(screen.getByTestId('poem-actions')).toHaveClass('opacity-100');
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

    it('exposes the author dot as a real, keyboard-operable button', () => {
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

      // A native <button> is keyboard-accessible by construction (Enter/Space
      // activate it), unlike the old role="button" div.
      expect(firstDot.tagName).toBe('BUTTON');
      expect(firstDot).not.toBeDisabled();

      // The activation the keyboard produces reveals the author byline.
      act(() => {
        fireEvent.click(firstDot);
      });
      const aliceBylines = screen.getAllByText(/— Alice/i);
      expect(aliceBylines[0]).toHaveClass('opacity-100');
    });

    it('does not expose hidden lines as tappable targets', () => {
      render(
        <PoemDisplay
          poemId={mockPoemId}
          lines={mockLines}
          onDone={mockOnDone}
          alreadyRevealed={false}
        />
      );

      // Before reveal, the dot is disabled so a stray tap reveals nothing.
      const firstDot = screen.getAllByRole('button', {
        name: /Show author/i,
      })[0];
      expect(firstDot).toBeDisabled();
    });

    it('announces the AI persona as a reveal moment (no tap needed)', () => {
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

      // The persona announces itself the moment the line is revealed —
      // no dot click required (it's part of the comedy).
      expect(screen.getByText(/✦ Bashō writes/i)).toBeInTheDocument();
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

      // The ink mark (inner span) carries the color; the button is the hit zone
      const dots = screen
        .getAllByRole('button', { name: /Show author/i })
        .map((btn) => btn.querySelector('span'));
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

      const dots = screen
        .getAllByRole('button', { name: /Show author/i })
        .map((btn) => btn.querySelector('span'));
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
      const ink = screen
        .getByRole('button', { name: /Show author/i })
        .querySelector('span');
      expect(ink?.getAttribute('style')).toContain('var(--color-text-muted)');
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

  describe('archive variant metadata header', () => {
    // Noon UTC keeps the calendar day stable across the local test-runner's
    // timezone, unlike a bare date string parsed at UTC midnight.
    const testCreatedAt = Date.UTC(2026, 0, 15, 12);
    const expectedDateText = new Date(testCreatedAt).toLocaleDateString(
      'en-US',
      { month: 'short', day: 'numeric' }
    );
    const archiveMetadata = {
      createdAt: testCreatedAt,
      backHref: '/archive',
      backLabel: 'Back to archive',
      isParticipant: true,
      isFavorited: false,
      onToggleFavorite: vi.fn(),
    };

    it('shows the back link and lets a participant toggle the room-favorite heart', () => {
      const onToggleFavorite = vi.fn();
      const { rerender } = render(
        <PoemDisplay
          poemId={mockPoemId}
          lines={mockLines}
          variant="archive"
          metadata={{
            ...archiveMetadata,
            onToggleFavorite,
            isFavorited: false,
          }}
        />
      );

      expect(
        screen.getByRole('link', { name: 'Back to archive' })
      ).toHaveAttribute('href', '/archive');

      const heartButton = screen.getByRole('button', {
        name: 'Add to favorites',
      });
      fireEvent.click(heartButton);
      expect(onToggleFavorite).toHaveBeenCalledTimes(1);

      rerender(
        <PoemDisplay
          poemId={mockPoemId}
          lines={mockLines}
          variant="archive"
          metadata={{ ...archiveMetadata, onToggleFavorite, isFavorited: true }}
        />
      );

      expect(
        screen.getByRole('button', { name: 'Remove from favorites' })
      ).toBeInTheDocument();
    });

    it('falls back to the default back label when none is provided', () => {
      render(
        <PoemDisplay
          poemId={mockPoemId}
          lines={mockLines}
          variant="archive"
          metadata={{ createdAt: testCreatedAt, backHref: '/archive' }}
        />
      );

      expect(screen.getByRole('link', { name: '← Back' })).toBeInTheDocument();
    });

    it('does not offer favorite controls to a non-participant viewer', () => {
      render(
        <PoemDisplay
          poemId={mockPoemId}
          lines={mockLines}
          variant="archive"
          metadata={{
            createdAt: testCreatedAt,
            isParticipant: false,
            onToggleFavorite: vi.fn(),
          }}
        />
      );

      expect(
        screen.queryByRole('button', { name: /favorites/i })
      ).not.toBeInTheDocument();
    });

    it('truncates a long first line in the header title', () => {
      const longLine =
        'A remarkably long opening line that easily exceeds forty characters';
      const linesWithLongFirst: PoemLine[] = [
        { text: longLine, authorName: 'Alice', authorStableId: 'stable_alice' },
        ...mockLines.slice(1),
      ];

      render(
        <PoemDisplay
          poemId={mockPoemId}
          lines={linesWithLongFirst}
          variant="archive"
          metadata={{ createdAt: testCreatedAt }}
        />
      );

      expect(
        screen.getByText(`${longLine.slice(0, 40)}...`, { exact: false })
      ).toBeInTheDocument();
    });

    it('falls back to the metadata first line when there are no poem lines yet', () => {
      render(
        <PoemDisplay
          poemId={mockPoemId}
          lines={[]}
          variant="archive"
          metadata={{
            createdAt: testCreatedAt,
            firstLine: 'Fallback title from metadata',
          }}
        />
      );

      expect(
        screen.getByText(/Fallback title from metadata/)
      ).toBeInTheDocument();
      // A zero-line poem is trivially "fully revealed" the instant it mounts.
      expect(screen.getByTestId('poem-actions')).toHaveClass('opacity-100');
    });

    it('shows an empty title when there is no line text and no metadata fallback', () => {
      render(
        <PoemDisplay
          poemId={mockPoemId}
          lines={[]}
          variant="archive"
          metadata={{ createdAt: testCreatedAt }}
        />
      );

      // The header still renders (date is present) even with nothing to quote.
      expect(screen.getByText(expectedDateText)).toBeInTheDocument();
    });

    it('labels a contributor as Unknown when no author name is recorded', () => {
      const linesWithMysteryAuthor: PoemLine[] = [
        { text: 'A quiet line', authorStableId: 'stable_mystery' },
      ];

      render(
        <PoemDisplay
          poemId={mockPoemId}
          lines={linesWithMysteryAuthor}
          variant="archive"
          metadata={{ createdAt: testCreatedAt }}
        />
      );

      expect(screen.getByText('Unknown')).toBeInTheDocument();
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
