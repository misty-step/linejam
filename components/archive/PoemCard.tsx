'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { cn } from '@/lib/utils';
import { PoemSilhouette } from './PoemSilhouette';
import { AuthorDots } from './AuthorDots';
import { playSound } from '@/lib/audio';

interface PoemCardProps {
  poem: {
    _id: Id<'poems'>;
    preview: string;
    lines: Array<{
      text: string;
      wordCount: number;
      authorKey: string;
      authorName: string;
    }>;
    poetCount: number;
    lineCount: number;
    isFavorited: boolean;
    publicShareEnabled?: boolean;
    createdAt: number;
    coAuthors: string[];
  };
  guestToken: string | null;
  variant?: 'default' | 'featured';
}

export function PoemCard({
  poem,
  guestToken,
  variant = 'default',
}: PoemCardProps) {
  const [isFavoriting, setIsFavoriting] = useState(false);
  const [localFavorited, setLocalFavorited] = useState(poem.isFavorited);
  const [isRevoking, setIsRevoking] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const toggleFavorite = useMutation(api.favorites.toggleFavorite);
  const disablePublicPoemShare = useMutation(api.shares.disablePublicPoemShare);
  const isFeatured = variant === 'featured';
  const formattedDate = new Date(poem.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  async function handleFavoriteClick() {
    if (isFavoriting) return;
    setIsFavoriting(true);
    setLocalFavorited((prev) => !prev);
    try {
      await toggleFavorite({
        poemId: poem._id,
        guestToken: guestToken || undefined,
      });
      playSound('success');
    } catch {
      playSound('error');
      setLocalFavorited((prev) => !prev);
    } finally {
      setIsFavoriting(false);
    }
  }

  async function handleRevokeShare() {
    if (isRevoking) return;
    setIsRevoking(true);
    setShareError(null);
    try {
      await disablePublicPoemShare({
        poemId: poem._id,
        guestToken: guestToken || undefined,
      });
      playSound('success');
    } catch {
      playSound('error');
      setShareError('Could not revoke the public link. Try again.');
    } finally {
      setIsRevoking(false);
    }
  }

  return (
    <article
      className={cn(
        'min-w-0 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6',
        isFeatured && 'sm:col-span-2'
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-sm text-[var(--color-text-muted)]">
          <PoemSilhouette
            wordCounts={poem.lines.map((line) => line.wordCount)}
          />
          <span>
            {poem.lineCount} {poem.lineCount === 1 ? 'line' : 'lines'}
          </span>
        </div>
        <button
          type="button"
          onClick={handleFavoriteClick}
          data-sound="loading"
          disabled={isFavoriting}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-[var(--color-primary)] hover:bg-[var(--color-muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:opacity-50"
          aria-label={
            localFavorited ? 'Remove from favorites' : 'Add to favorites'
          }
          aria-pressed={localFavorited}
        >
          <Heart
            className="h-5 w-5"
            fill={localFavorited ? 'currentColor' : 'none'}
            aria-hidden="true"
          />
        </button>
      </div>

      <Link
        href={`/poem/${poem._id}`}
        data-testid="poem-card"
        className="block rounded-[var(--radius-sm)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-focus-ring)]"
      >
        <p className="mb-5 break-words text-left font-sans text-xl leading-relaxed text-[var(--color-text-primary)] line-clamp-3">
          {poem.preview}
        </p>
        {poem.coAuthors.length > 0 && (
          <p className="mb-5 break-words text-sm text-[var(--color-text-secondary)]">
            with {poem.coAuthors.join(', ')}
            {poem.poetCount > poem.coAuthors.length + 1 &&
              ` +${poem.poetCount - poem.coAuthors.length - 1}`}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--color-text-muted)]">
          <div className="flex items-center gap-2">
            <AuthorDots
              authorStableIds={poem.lines.map((line) => line.authorKey)}
            />
            <span>
              {poem.poetCount} {poem.poetCount === 1 ? 'poet' : 'poets'}
            </span>
          </div>
          <time dateTime={new Date(poem.createdAt).toISOString()}>
            {formattedDate}
          </time>
        </div>
      </Link>

      {poem.publicShareEnabled && (
        <button
          type="button"
          disabled={isRevoking}
          onClick={handleRevokeShare}
          data-sound="loading"
          className="mt-3 inline-flex min-h-11 items-center text-sm text-[var(--color-primary)] underline underline-offset-4 disabled:opacity-50"
        >
          {isRevoking ? 'Revoking…' : 'Revoke public link'}
        </button>
      )}
      {shareError && (
        <p role="alert" className="mt-2 text-sm text-[var(--color-error)]">
          {shareError}
        </p>
      )}
    </article>
  );
}

export function PoemCardSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading poem"
      className="rounded-[var(--radius-lg)] bg-[var(--color-surface)] p-6 motion-safe:animate-pulse"
    >
      <div className="mb-6 h-5 w-20 rounded-full bg-[var(--color-muted)]" />
      <div className="space-y-3">
        <div className="h-6 w-3/4 rounded-[var(--radius-sm)] bg-[var(--color-muted)]" />
        <div className="h-6 w-1/2 rounded-[var(--radius-sm)] bg-[var(--color-muted)]" />
      </div>
      <div className="mt-6 h-4 w-24 rounded-[var(--radius-sm)] bg-[var(--color-muted)]" />
    </div>
  );
}
