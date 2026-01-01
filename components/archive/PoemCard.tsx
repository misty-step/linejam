/**
 * PoemCard: Rich archive card component
 *
 * Deep module (Ousterhout): Composes shape, authors, favorite toggle,
 * and all interactions into a single cohesive component.
 *
 * Design (Stripe): Information density with clear hierarchy,
 * purposeful animation, progressive disclosure.
 */

'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { cn } from '@/lib/utils';
import { PoemShape } from './PoemShape';
import { AuthorDots } from './AuthorDots';

interface PoemCardProps {
  poem: {
    _id: Id<'poems'>;
    preview: string;
    lines: Array<{
      text: string;
      wordCount: number;
      authorStableId: string;
      authorName: string;
      isBot: boolean;
    }>;
    poetCount: number;
    lineCount: number;
    isFavorited: boolean;
    createdAt: number;
    coAuthors: string[];
  };
  guestToken: string | null;
  /** Animation delay for staggered entrance */
  animationDelay?: number;
  /** Card variant */
  variant?: 'default' | 'featured';
}

/**
 * PoemCard component
 *
 * Features:
 * - Shape visualization (word counts)
 * - Author dots (contributors)
 * - Inline favorite toggle
 * - Hover interactions
 * - Staggered animation
 */
export function PoemCard({
  poem,
  guestToken,
  animationDelay = 0,
  variant = 'default',
}: PoemCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isFavoriting, setIsFavoriting] = useState(false);
  const [localFavorited, setLocalFavorited] = useState(poem.isFavorited);

  const toggleFavorite = useMutation(api.favorites.toggleFavorite);

  const wordCounts = poem.lines.map((l) => l.wordCount);
  const authorStableIds = poem.lines.map((l) => l.authorStableId);
  const uniqueAuthorIds = [...new Set(authorStableIds)];

  const formattedDate = new Date(poem.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  const handleFavoriteClick = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (isFavoriting) return;

      setIsFavoriting(true);
      // Optimistic update
      setLocalFavorited((prev) => !prev);

      try {
        await toggleFavorite({
          poemId: poem._id,
          guestToken: guestToken || undefined,
        });
      } catch {
        // Revert on error
        setLocalFavorited((prev) => !prev);
      } finally {
        setIsFavoriting(false);
      }
    },
    [poem._id, guestToken, toggleFavorite, isFavoriting]
  );

  const isFeatured = variant === 'featured';

  return (
    <Link
      href={`/poem/${poem._id}`}
      className={cn(
        'group relative block',
        'opacity-0 animate-fade-in-up',
        isFeatured && 'sm:col-span-2 lg:col-span-2'
      )}
      style={{
        animationDelay: `${animationDelay}ms`,
        animationFillMode: 'forwards',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-testid="poem-card"
    >
      <article
        className={cn(
          // Base styles
          'relative h-full bg-[var(--color-surface)]',
          'border border-[var(--color-border)]',
          'shadow-[var(--shadow-sm)]',
          'transition-all duration-[var(--duration-normal)]',
          // Hover states
          'group-hover:shadow-[var(--shadow-md)]',
          'group-hover:-translate-y-1',
          'group-hover:border-[var(--color-border-subtle)]',
          // Featured variant
          isFeatured ? 'p-8' : 'p-6'
        )}
      >
        {/* Top Row: Shape + Favorite */}
        <div className="flex items-start justify-between mb-4">
          <PoemShape
            wordCounts={wordCounts}
            size={isFeatured ? 'md' : 'sm'}
            animate={isHovered}
          />

          {/* Favorite Button */}
          <button
            onClick={handleFavoriteClick}
            disabled={isFavoriting}
            className={cn(
              'p-1 -m-1 transition-all duration-[var(--duration-fast)]',
              'hover:scale-110 active:scale-95',
              'focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:ring-offset-2',
              isFavoriting && 'opacity-50 cursor-not-allowed'
            )}
            aria-label={
              localFavorited ? 'Remove from favorites' : 'Add to favorites'
            }
          >
            <svg
              className={cn(
                'w-5 h-5 transition-colors duration-[var(--duration-fast)]',
                localFavorited
                  ? 'text-[var(--color-primary)] fill-current'
                  : 'text-[var(--color-text-muted)] group-hover:text-[var(--color-text-secondary)]'
              )}
              viewBox="0 0 24 24"
              fill={localFavorited ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
          </button>
        </div>

        {/* Preview Text */}
        <div className="mb-6">
          <p
            className={cn(
              'font-[var(--font-display)] italic leading-relaxed',
              'text-[var(--color-text-primary)]',
              'line-clamp-2',
              isFeatured ? 'text-2xl md:text-3xl' : 'text-xl'
            )}
          >
            &ldquo;{poem.preview}...&rdquo;
          </p>
        </div>

        {/* Co-authors (if any) */}
        {poem.coAuthors.length > 0 && (
          <p className="text-sm text-[var(--color-text-muted)] mb-4 line-clamp-1">
            with {poem.coAuthors.join(', ')}
            {poem.poetCount > poem.coAuthors.length + 1 &&
              ` +${poem.poetCount - poem.coAuthors.length - 1}`}
          </p>
        )}

        {/* Bottom Row: Authors + Date */}
        <div className="flex items-center justify-between pt-4 border-t border-[var(--color-border-subtle)]">
          <AuthorDots
            authorStableIds={uniqueAuthorIds}
            size={isFeatured ? 'md' : 'sm'}
          />

          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-[var(--color-text-muted)]">
              {formattedDate}
            </span>

            {/* Read arrow - appears on hover */}
            <span
              className={cn(
                'text-[var(--color-primary)] text-sm',
                'opacity-0 -translate-x-2',
                'transition-all duration-[var(--duration-fast)]',
                'group-hover:opacity-100 group-hover:translate-x-0'
              )}
              aria-hidden="true"
            >
              &rarr;
            </span>
          </div>
        </div>

        {/* Stats Badge (on hover) */}
        <div
          className={cn(
            'absolute top-0 right-0 -translate-y-1/2',
            'px-2 py-1 text-xs font-mono',
            'bg-[var(--color-surface)] border border-[var(--color-border)]',
            'text-[var(--color-text-muted)]',
            'opacity-0 scale-95 transition-all duration-[var(--duration-fast)]',
            isHovered && 'opacity-100 scale-100'
          )}
        >
          {poem.lineCount} lines
        </div>
      </article>
    </Link>
  );
}

/**
 * PoemCardSkeleton: Loading placeholder
 */
export function PoemCardSkeleton() {
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-6 animate-pulse">
      {/* Shape skeleton */}
      <div className="flex flex-col items-center gap-1 mb-4">
        {[1, 2, 3, 4, 5, 4, 3, 2, 1].map((w, i) => (
          <div
            key={i}
            className="h-0.5 bg-[var(--color-muted)] rounded-full"
            style={{ width: `${w * 4}px` }}
          />
        ))}
      </div>

      {/* Text skeleton */}
      <div className="space-y-2 mb-6">
        <div className="h-6 bg-[var(--color-muted)] rounded w-3/4" />
        <div className="h-6 bg-[var(--color-muted)] rounded w-1/2" />
      </div>

      {/* Footer skeleton */}
      <div className="flex justify-between items-center pt-4 border-t border-[var(--color-border-subtle)]">
        <div className="flex gap-1">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-[var(--color-muted)]"
            />
          ))}
        </div>
        <div className="h-4 bg-[var(--color-muted)] rounded w-16" />
      </div>
    </div>
  );
}
