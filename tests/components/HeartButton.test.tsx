// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { Id } from '@/convex/_generated/dataModel';

const mockToggleFavorite = vi.fn();
let favoritedReturn: boolean | undefined = false;

vi.mock('convex/react', () => ({
  useMutation: () => mockToggleFavorite,
  useQuery: () => favoritedReturn,
}));

const mockCaptureError = vi.fn();
vi.mock('@/lib/error', () => ({
  captureError: (...args: unknown[]) => mockCaptureError(...args),
}));

import { HeartButton } from '@/components/ui/HeartButton';

const poemId = 'poem_1' as Id<'poems'>;

describe('HeartButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    favoritedReturn = false;
    mockToggleFavorite.mockResolvedValue(undefined);
  });

  it('renders an unpressed heart when not favorited', () => {
    favoritedReturn = false;
    render(<HeartButton poemId={poemId} guestToken="t" />);
    const button = screen.getByRole('button', { name: /favorite this poem/i });
    expect(button).toHaveAttribute('aria-pressed', 'false');
  });

  it('renders a pressed heart when favorited', () => {
    favoritedReturn = true;
    render(<HeartButton poemId={poemId} guestToken="t" />);
    const button = screen.getByRole('button', { name: /remove favorite/i });
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });

  it('toggles the favorite on click', async () => {
    const user = userEvent.setup();
    render(<HeartButton poemId={poemId} guestToken="tok" />);

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
    render(<HeartButton poemId={poemId} />);

    await user.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(mockCaptureError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ operation: 'toggleFavorite' })
      );
    });
  });
});
