'use client';

import { Heart } from 'lucide-react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { cn } from '@/lib/utils';
import { captureError } from '@/lib/error';

interface HeartButtonProps {
  poemId: Id<'poems'>;
  guestToken?: string;
  className?: string;
}

/**
 * Self-contained favorite toggle for the reveal ceremony. Hearts are
 * idempotent per player per poem (the mutation toggles a single row), so
 * tapping twice simply un-hearts. Optimistic-feeling because the query is
 * reactive — the fill updates the instant the mutation lands.
 */
export function HeartButton({
  poemId,
  guestToken,
  className,
}: HeartButtonProps) {
  const isFavorited = useQuery(api.favorites.isFavorited, {
    poemId,
    guestToken: guestToken || undefined,
  });
  const toggleFavorite = useMutation(api.favorites.toggleFavorite);

  const handleToggle = async () => {
    try {
      await toggleFavorite({ poemId, guestToken: guestToken || undefined });
    } catch (err) {
      captureError(err, { poemId, operation: 'toggleFavorite' });
    }
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-pressed={isFavorited === true}
      aria-label={isFavorited ? 'Remove favorite' : 'Favorite this poem'}
      className={cn(
        'inline-flex min-h-11 min-w-11 items-center justify-center rounded-full',
        'transition-colors duration-[var(--duration-fast)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2',
        isFavorited
          ? 'text-[var(--color-primary)]'
          : 'text-text-muted hover:text-text-secondary',
        className
      )}
    >
      <Heart
        className="h-6 w-6 transition-transform duration-[var(--duration-fast)] active:scale-90"
        fill={isFavorited ? 'currentColor' : 'none'}
      />
    </button>
  );
}
