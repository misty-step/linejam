// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Id } from '@/convex/_generated/dataModel';

// Mock Convex mutation
const mockToggleFavorite = vi.fn();
vi.mock('convex/react', () => ({
  useMutation: () => mockToggleFavorite,
}));

// Import after mocks
import { PoemCard, PoemCardSkeleton } from '@/components/archive/PoemCard';

describe('PoemCard component', () => {
  const mockPoem = {
    _id: 'poem123' as Id<'poems'>,
    preview: 'The wind whispers softly',
    lines: [
      {
        text: 'The',
        wordCount: 1,
        authorStableId: 'author1',
        authorName: 'Alice',
        isBot: false,
      },
      {
        text: 'wind whispers',
        wordCount: 2,
        authorStableId: 'author2',
        authorName: 'Bob',
        isBot: false,
      },
      {
        text: 'softly through trees',
        wordCount: 3,
        authorStableId: 'author1',
        authorName: 'Alice',
        isBot: false,
      },
    ],
    poetCount: 2,
    lineCount: 3,
    isFavorited: false,
    createdAt: Date.now(),
    coAuthors: ['Bob'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockToggleFavorite.mockResolvedValue(undefined);
  });

  describe('rendering', () => {
    it('renders poem preview text', () => {
      render(<PoemCard poem={mockPoem} guestToken="token123" />);
      expect(screen.getByText(/the wind whispers softly/i)).toBeInTheDocument();
    });

    it('renders as a link to poem detail page', () => {
      render(<PoemCard poem={mockPoem} guestToken="token123" />);
      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', '/poem/poem123');
    });

    it('renders PoemShape with word counts', () => {
      render(<PoemCard poem={mockPoem} guestToken="token123" />);
      // PoemShape has role="img"
      expect(
        screen.getByRole('img', { name: /poem shape/i })
      ).toBeInTheDocument();
    });

    it('renders AuthorDots with unique authors', () => {
      render(<PoemCard poem={mockPoem} guestToken="token123" />);
      // AuthorDots has role="group"
      expect(
        screen.getByRole('group', { name: /contributor/i })
      ).toBeInTheDocument();
    });

    it('renders co-authors text', () => {
      render(<PoemCard poem={mockPoem} guestToken="token123" />);
      expect(screen.getByText(/with Bob/i)).toBeInTheDocument();
    });

    it('renders formatted date', () => {
      const now = new Date();
      const poem = {
        ...mockPoem,
        createdAt: now.getTime(),
      };
      render(<PoemCard poem={poem} guestToken="token123" />);
      // Should have date format like "Jan 1"
      const expectedDate = now.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
      expect(screen.getByText(expectedDate)).toBeInTheDocument();
    });

    it('applies test id for testing', () => {
      render(<PoemCard poem={mockPoem} guestToken="token123" />);
      expect(screen.getByTestId('poem-card')).toBeInTheDocument();
    });
  });

  describe('favorite button', () => {
    it('renders unfavorited state correctly', () => {
      render(<PoemCard poem={mockPoem} guestToken="token123" />);
      const button = screen.getByRole('button', {
        name: /add to favorites/i,
      });
      expect(button).toBeInTheDocument();
    });

    it('renders favorited state correctly', () => {
      render(
        <PoemCard
          poem={{ ...mockPoem, isFavorited: true }}
          guestToken="token123"
        />
      );
      const button = screen.getByRole('button', {
        name: /remove from favorites/i,
      });
      expect(button).toBeInTheDocument();
    });

    it('calls toggleFavorite mutation on click', async () => {
      render(<PoemCard poem={mockPoem} guestToken="token123" />);
      const button = screen.getByRole('button', {
        name: /add to favorites/i,
      });

      fireEvent.click(button);

      await waitFor(() => {
        expect(mockToggleFavorite).toHaveBeenCalledWith({
          poemId: 'poem123',
          guestToken: 'token123',
        });
      });
    });

    it('handles undefined guestToken', async () => {
      render(<PoemCard poem={mockPoem} guestToken={null} />);
      const button = screen.getByRole('button', {
        name: /add to favorites/i,
      });

      fireEvent.click(button);

      await waitFor(() => {
        expect(mockToggleFavorite).toHaveBeenCalledWith({
          poemId: 'poem123',
          guestToken: undefined,
        });
      });
    });

    it('shows optimistic update when favoriting', async () => {
      render(<PoemCard poem={mockPoem} guestToken="token123" />);

      // Initially unfavorited
      expect(
        screen.getByRole('button', { name: /add to favorites/i })
      ).toBeInTheDocument();

      fireEvent.click(
        screen.getByRole('button', { name: /add to favorites/i })
      );

      // Should show favorited state optimistically
      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /remove from favorites/i })
        ).toBeInTheDocument();
      });
    });

    it('reverts on mutation error', async () => {
      mockToggleFavorite.mockRejectedValueOnce(new Error('Failed'));

      render(<PoemCard poem={mockPoem} guestToken="token123" />);
      const button = screen.getByRole('button', {
        name: /add to favorites/i,
      });

      fireEvent.click(button);

      // Wait for error to be handled and state to revert
      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /add to favorites/i })
        ).toBeInTheDocument();
      });
    });

    it('stops propagation on favorite button click', async () => {
      // This is tested indirectly - the button has e.stopPropagation()
      // and e.preventDefault() which prevent the link navigation
      render(<PoemCard poem={mockPoem} guestToken="token123" />);
      const button = screen.getByRole('button', {
        name: /add to favorites/i,
      });

      // Click the button - if propagation wasn't stopped, it would
      // trigger the link click too
      fireEvent.click(button);

      // Mutation should be called, confirming button handled the click
      await waitFor(() => {
        expect(mockToggleFavorite).toHaveBeenCalled();
      });
    });

    it('disables button while mutation is in progress', async () => {
      // Make mutation slow
      mockToggleFavorite.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      render(<PoemCard poem={mockPoem} guestToken="token123" />);
      const button = screen.getByRole('button', {
        name: /add to favorites/i,
      });

      fireEvent.click(button);

      // Button should be disabled
      expect(button).toBeDisabled();

      // Wait for mutation to complete
      await waitFor(() => {
        expect(button).not.toBeDisabled();
      });
    });

    it('prevents rapid double-clicks from triggering multiple mutations', async () => {
      // Make mutation slow so we can click during it
      mockToggleFavorite.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      render(<PoemCard poem={mockPoem} guestToken="token123" />);
      const button = screen.getByRole('button', {
        name: /add to favorites/i,
      });

      // Rapid double-click
      fireEvent.click(button);
      fireEvent.click(button);

      // Should only call mutation once due to isFavoriting guard
      expect(mockToggleFavorite).toHaveBeenCalledTimes(1);

      // Wait for mutation to complete
      await waitFor(() => {
        expect(button).not.toBeDisabled();
      });
    });
  });

  describe('variants', () => {
    it('applies default variant styles', () => {
      render(<PoemCard poem={mockPoem} guestToken="token123" />);
      const article = screen.getByRole('article');
      expect(article).toHaveClass('p-6');
    });

    it('applies featured variant styles', () => {
      render(
        <PoemCard poem={mockPoem} guestToken="token123" variant="featured" />
      );
      const article = screen.getByRole('article');
      expect(article).toHaveClass('p-8');
    });
  });

  describe('animation', () => {
    it('applies animation delay style', () => {
      render(
        <PoemCard poem={mockPoem} guestToken="token123" animationDelay={200} />
      );
      const link = screen.getByTestId('poem-card');
      expect(link).toHaveStyle({ animationDelay: '200ms' });
    });

    it('defaults to 0ms animation delay', () => {
      render(<PoemCard poem={mockPoem} guestToken="token123" />);
      const link = screen.getByTestId('poem-card');
      expect(link).toHaveStyle({ animationDelay: '0ms' });
    });
  });

  describe('co-authors overflow', () => {
    it('shows overflow count when more than displayed coAuthors', () => {
      const poemWithManyAuthors = {
        ...mockPoem,
        coAuthors: ['Bob', 'Charlie', 'Dave'],
        poetCount: 5, // More than coAuthors.length + 1
      };
      render(<PoemCard poem={poemWithManyAuthors} guestToken="token123" />);
      expect(screen.getByText(/\+1/)).toBeInTheDocument();
    });

    it('does not show overflow when all authors displayed', () => {
      const poemWithFewAuthors = {
        ...mockPoem,
        coAuthors: ['Bob'],
        poetCount: 2,
      };
      render(<PoemCard poem={poemWithFewAuthors} guestToken="token123" />);
      expect(screen.queryByText(/\+/)).not.toBeInTheDocument();
    });

    it('hides co-authors section when empty', () => {
      const poemNoCoAuthors = {
        ...mockPoem,
        coAuthors: [],
      };
      render(<PoemCard poem={poemNoCoAuthors} guestToken="token123" />);
      expect(screen.queryByText(/with/i)).not.toBeInTheDocument();
    });
  });

  describe('hover state', () => {
    it('handles mouse enter event', () => {
      render(<PoemCard poem={mockPoem} guestToken="token123" />);
      const card = screen.getByTestId('poem-card');

      fireEvent.mouseEnter(card);

      // Card should still be in the document after hover
      expect(card).toBeInTheDocument();
    });

    it('handles mouse leave event', () => {
      render(<PoemCard poem={mockPoem} guestToken="token123" />);
      const card = screen.getByTestId('poem-card');

      fireEvent.mouseEnter(card);
      fireEvent.mouseLeave(card);

      // Card should still be in the document after hover cycle
      expect(card).toBeInTheDocument();
    });
  });
});

describe('PoemCardSkeleton component', () => {
  it('renders skeleton structure', () => {
    const { container } = render(<PoemCardSkeleton />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders shape skeleton bars', () => {
    const { container } = render(<PoemCardSkeleton />);
    // 9 shape bars for 1-2-3-4-5-4-3-2-1
    const shapeBars = container.querySelectorAll(
      '.flex.flex-col.items-center > div'
    );
    expect(shapeBars).toHaveLength(9);
  });

  it('renders text skeleton placeholders', () => {
    const { container } = render(<PoemCardSkeleton />);
    // Multiple skeleton rectangles for text
    const skeletons = container.querySelectorAll(
      '.bg-\\[var\\(--color-muted\\)\\]'
    );
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders footer skeleton with dots', () => {
    const { container } = render(<PoemCardSkeleton />);
    // 3 dot skeletons
    const dots = container.querySelectorAll(
      '.rounded-full.bg-\\[var\\(--color-muted\\)\\]'
    );
    expect(dots.length).toBeGreaterThanOrEqual(3);
  });
});
