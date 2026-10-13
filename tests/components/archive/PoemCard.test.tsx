// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConvexProvider } from 'convex/react';
import { createTestConvexClient } from '@/tests/helpers/convexClient';

import type { FunctionArgs } from 'convex/server';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { PoemCard } from '@/components/archive/PoemCard';

const mockToggleFavorite = vi.fn();

type PoemCardMutation = typeof api.favorites.toggleFavorite;
type PoemCardMutationArgs = FunctionArgs<PoemCardMutation>;

const mockConvexClient = Object.assign(createTestConvexClient(), {
  mutation: vi.fn((_ref: PoemCardMutation, args: PoemCardMutationArgs) => {
    return mockToggleFavorite(args);
  }),
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
  });

  describe('favorite button', () => {
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
});
