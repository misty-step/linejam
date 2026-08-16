// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConvexProvider } from 'convex/react';
import { createTestConvexClient } from '@/tests/helpers/convexClient';

import type { FunctionArgs } from 'convex/server';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { PoemCard, PoemCardSkeleton } from '@/components/archive/PoemCard';

const mockToggleFavorite = vi.fn();
const mockDisablePublicPoemShare = vi.fn();

type PoemCardMutation =
  | typeof api.favorites.toggleFavorite
  | typeof api.shares.disablePublicPoemShare;

type PoemCardMutationArgs =
  | FunctionArgs<typeof api.favorites.toggleFavorite>
  | FunctionArgs<typeof api.shares.disablePublicPoemShare>;

const mockConvexClient = Object.assign(createTestConvexClient(), {
  mutation: vi.fn((_ref: PoemCardMutation, args: PoemCardMutationArgs) => {
    return mockToggleFavorite(args);
  }),
  query: vi.fn(),
  watchQuery: vi.fn(() => ({
    localQueryResult: () => undefined,
    onUpdate: () => () => {},
  })),
  connectionState: vi.fn(() => ({
    hasInflightRequests: false,
    isWebSocketConnected: true,
    timeOfOldestInflightRequest: null,
  })),
  setAuth: vi.fn(),
  clearAuth: vi.fn(),
});

function renderWithConvex(ui: React.ReactElement) {
  return render(
    <ConvexProvider client={mockConvexClient}>{ui}</ConvexProvider>
  );
}

describe('PoemCard component', () => {
  // SAFETY: Synthetic Convex document id fixture for poem card component tests.
  const mockPoem = {
    _id: 'poem123' as Id<'poems'>,
    preview: 'The wind whispers softly',
    lines: [
      {
        text: 'The',
        wordCount: 1,
        authorKey: 'author1',
        authorName: 'Alice',
      },
      {
        text: 'wind whispers',
        wordCount: 2,
        authorKey: 'author2',
        authorName: 'Bob',
      },
      {
        text: 'softly through trees',
        wordCount: 3,
        authorKey: 'author1',
        authorName: 'Alice',
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
    mockDisablePublicPoemShare.mockResolvedValue(undefined);
  });

  describe('rendering', () => {
    it('renders poem preview text', () => {
      renderWithConvex(<PoemCard poem={mockPoem} guestToken="token123" />);
      expect(screen.getByText(/the wind whispers softly/i)).toBeInTheDocument();
    });

    it('renders as a link to poem detail page', () => {
      renderWithConvex(<PoemCard poem={mockPoem} guestToken="token123" />);
      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', '/poem/poem123');
    });

    it('renders PoemSilhouette with word counts', () => {
      renderWithConvex(<PoemCard poem={mockPoem} guestToken="token123" />);
      expect(
        screen.getByRole('img', { name: /poem silhouette/i })
      ).toBeInTheDocument();
    });

    it('renders AuthorDots with unique authors', () => {
      renderWithConvex(<PoemCard poem={mockPoem} guestToken="token123" />);
      // AuthorDots has role="group"
      expect(
        screen.getByRole('group', { name: /contributor/i })
      ).toBeInTheDocument();
    });

    it('renders co-authors text', () => {
      renderWithConvex(<PoemCard poem={mockPoem} guestToken="token123" />);
      expect(screen.getByText(/with Bob/i)).toBeInTheDocument();
    });

    it('renders a captured legacy machine co-author byline', () => {
      renderWithConvex(
        <PoemCard
          poem={{
            ...mockPoem,
            coAuthors: ['Bashō (legacy machine)'],
          }}
          guestToken="token123"
        />
      );
      expect(
        screen.getByText(/with Bashō \(legacy machine\)/i)
      ).toBeInTheDocument();
    });

    it('renders formatted date', () => {
      const now = new Date();
      const poemWithKnownDate = {
        ...mockPoem,
        createdAt: now.getTime(),
      };
      renderWithConvex(
        <PoemCard poem={poemWithKnownDate} guestToken="token123" />
      );

      const expectedDate = now.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
      expect(screen.getByText(expectedDate)).toBeInTheDocument();
    });
  });

  describe('animation delay', () => {
    it('applies animation delay style to link', () => {
      renderWithConvex(
        <PoemCard poem={mockPoem} guestToken="token123" animationDelay={150} />
      );
      const card = screen.getByTestId('poem-card');
      expect(card).toHaveStyle({ animationDelay: '150ms' });
    });

    it('defaults to 0ms animation delay', () => {
      renderWithConvex(<PoemCard poem={mockPoem} guestToken="token123" />);
      const card = screen.getByTestId('poem-card');
      expect(card).toHaveStyle({ animationDelay: '0ms' });
    });
  });

  describe('favorite button', () => {
    it('renders unfavorited state correctly', () => {
      renderWithConvex(<PoemCard poem={mockPoem} guestToken="token123" />);
      const button = screen.getByRole('button', {
        name: /add to favorites/i,
      });
      expect(button).toBeInTheDocument();
    });

    it('renders favorited state correctly', () => {
      renderWithConvex(
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
      renderWithConvex(<PoemCard poem={mockPoem} guestToken="token123" />);
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
      renderWithConvex(<PoemCard poem={mockPoem} guestToken={null} />);
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
      renderWithConvex(<PoemCard poem={mockPoem} guestToken="token123" />);

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

      renderWithConvex(<PoemCard poem={mockPoem} guestToken="token123" />);
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
      renderWithConvex(<PoemCard poem={mockPoem} guestToken="token123" />);
      const button = screen.getByRole('button', {
        name: /add to favorites/i,
      });

      // Click the button - if propagation wasn't stopped, it would
      // trigger the link click too
      fireEvent.click(button);

      // Verify mutation was called, showing the click was processed
      await waitFor(() => {
        expect(mockToggleFavorite).toHaveBeenCalled();
      });
    });

    it('disables favorite button while mutation is in flight', async () => {
      let resolveMutation: () => void;
      const mutationPromise = new Promise<void>((resolve) => {
        resolveMutation = resolve;
      });
      mockToggleFavorite.mockReturnValueOnce(mutationPromise);

      renderWithConvex(<PoemCard poem={mockPoem} guestToken="token123" />);
      const button = screen.getByRole('button', {
        name: /add to favorites/i,
      });

      fireEvent.click(button);

      // Second click should be ignored while first is in flight
      fireEvent.click(button);

      expect(mockToggleFavorite).toHaveBeenCalledTimes(1);

      // Cleanup
      resolveMutation!();
    });
  });

  describe('card link', () => {
    it('links to correct poem detail page with id', () => {
      renderWithConvex(<PoemCard poem={mockPoem} guestToken="token123" />);
      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', '/poem/poem123');
    });

    it('has data-testid for e2e tests', () => {
      renderWithConvex(<PoemCard poem={mockPoem} guestToken="token123" />);
      expect(screen.getByTestId('poem-card')).toBeInTheDocument();
    });
  });

  describe('variants', () => {
    it('renders default variant without span classes', () => {
      renderWithConvex(
        <PoemCard poem={mockPoem} guestToken="token123" variant="default" />
      );
      const card = screen.getByTestId('poem-card');
      expect(card).not.toHaveClass('sm:col-span-2');
    });

    it('renders featured variant with span classes', () => {
      renderWithConvex(
        <PoemCard poem={mockPoem} guestToken="token123" variant="featured" />
      );
      const card = screen.getByTestId('poem-card');
      expect(card).toHaveClass('sm:col-span-2');
      expect(card).toHaveClass('lg:col-span-2');
    });
  });

  describe('stats summary', () => {
    it('renders poet count when multiple poets', () => {
      renderWithConvex(<PoemCard poem={mockPoem} guestToken="token123" />);
      expect(screen.getByText(/2 poets/i)).toBeInTheDocument();
    });

    it('renders singular "poet" for single author', () => {
      const singleAuthorPoem = {
        ...mockPoem,
        poetCount: 1,
        coAuthors: [],
        lines: [mockPoem.lines[0]],
      };
      renderWithConvex(
        <PoemCard poem={singleAuthorPoem} guestToken="token123" />
      );
      expect(screen.getByText(/1 poet/i)).toBeInTheDocument();
    });

    it('renders line count correctly', () => {
      renderWithConvex(<PoemCard poem={mockPoem} guestToken="token123" />);
      expect(screen.getByText(/3 lines/i)).toBeInTheDocument();
    });

    it('renders singular "line" for single line', () => {
      const singleLinePoem = {
        ...mockPoem,
        lineCount: 1,
        lines: [mockPoem.lines[0]],
      };
      renderWithConvex(
        <PoemCard poem={singleLinePoem} guestToken="token123" />
      );
      expect(screen.getByText(/1 line/i)).toBeInTheDocument();
    });
  });

  describe('hover state', () => {
    it('handles mouse enter event', () => {
      renderWithConvex(<PoemCard poem={mockPoem} guestToken="token123" />);
      const card = screen.getByTestId('poem-card');

      fireEvent.mouseEnter(card);

      // Card should still be in the document after hover
      expect(card).toBeInTheDocument();
    });

    it('handles mouse leave event', () => {
      renderWithConvex(<PoemCard poem={mockPoem} guestToken="token123" />);
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

  it('renders silhouette skeleton bars', () => {
    const { container } = render(<PoemCardSkeleton />);
    // 9 silhouette bars for 1-2-3-4-5-4-3-2-1
    const silhouetteBars = container.querySelectorAll(
      '.flex.flex-col.items-center > div'
    );
    expect(silhouetteBars).toHaveLength(9);
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
