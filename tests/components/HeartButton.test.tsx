// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MockInstance } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { ConvexProvider } from 'convex/react';
import { createTestConvexClient } from '@/tests/helpers/convexClient';

import type { FunctionArgs } from 'convex/server';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { HeartButton } from '@/components/ui/HeartButton';
import * as errorModule from '@/lib/error';

const mockToggleFavorite = vi.fn();
let favoritedReturn: boolean | undefined = false;

type HeartButtonMutation = typeof api.favorites.toggleFavorite;
type HeartButtonMutationArgs = FunctionArgs<
  typeof api.favorites.toggleFavorite
>;

const mockConvexClient = Object.assign(createTestConvexClient(), {
  mutation: vi.fn(
    (_ref: HeartButtonMutation, args: HeartButtonMutationArgs) => {
      return mockToggleFavorite(args);
    }
  ),
  query: vi.fn(),
  watchQuery: vi.fn(() => ({
    localQueryResult: () => favoritedReturn,
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

function renderHeartButton(ui: React.ReactElement) {
  return render(
    <ConvexProvider client={mockConvexClient}>{ui}</ConvexProvider>
  );
}

// SAFETY: Synthetic Convex document id fixture for heart button tests.
const poemId = 'poem_1' as Id<'poems'>;

describe('HeartButton', () => {
  let captureErrorSpy: MockInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    favoritedReturn = false;
    mockToggleFavorite.mockResolvedValue(undefined);
    captureErrorSpy = vi
      .spyOn(errorModule, 'captureError')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    captureErrorSpy.mockRestore();
  });

  it('renders an unpressed heart when not favorited', () => {
    favoritedReturn = false;
    renderHeartButton(<HeartButton poemId={poemId} guestToken="t" />);
    const button = screen.getByRole('button', { name: /favorite this poem/i });
    expect(button).toHaveAttribute('aria-pressed', 'false');
  });

  it('renders a pressed heart when favorited', () => {
    favoritedReturn = true;
    renderHeartButton(<HeartButton poemId={poemId} guestToken="t" />);
    const button = screen.getByRole('button', { name: /remove favorite/i });
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });

  it('toggles the favorite on click', async () => {
    const user = userEvent.setup();
    renderHeartButton(<HeartButton poemId={poemId} guestToken="tok" />);

    await user.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(mockToggleFavorite).toHaveBeenCalledWith({
        poemId,
        guestToken: 'tok',
      });
    });
  });

  it('captures errors instead of throwing when the toggle fails', async () => {
    mockToggleFavorite.mockRejectedValueOnce(new Error('network'));
    const user = userEvent.setup();
    renderHeartButton(<HeartButton poemId={poemId} />);

    await user.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(captureErrorSpy).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ operation: 'toggleFavorite' })
      );
    });
  });
});
