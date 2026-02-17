'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import { Button } from './ui/Button';
import { cn } from '@/lib/utils';
import { Id } from '@/convex/_generated/dataModel';
import { useSharePoem } from '@/hooks/useSharePoem';
import { getUserColor, getUniqueColor } from '@/lib/avatarColor';

/**
 * PoemDisplay: Unified poem viewing experience
 *
 * Design:
 * - Author dots in left gutter (tap to reveal name)
 * - Wipe-reveal animation with rhythmic pacing
 * - Poem identity: date + first line preview + contributor dots
 *
 * Variants:
 * - 'reveal': Full-screen overlay for post-game reveal (default)
 * - 'archive': Regular page flow for archive viewing
 */

const BASE_REVEAL_DELAY = 1000;
const PAUSE_AFTER_LINE = 4;
const PAUSE_DURATION = 1200;

export interface PoemLine {
  text: string;
  authorName?: string;
  authorStableId?: string;
  isBot?: boolean;
}

export interface PoemMetadata {
  createdAt: number;
  firstLine?: string;
  // Archive-specific
  isParticipant?: boolean;
  isFavorited?: boolean;
  onToggleFavorite?: () => void;
  backHref?: string;
  backLabel?: string;
  uniquePoets?: number;
}

interface PoemDisplayProps {
  poemId: Id<'poems'>;
  lines: string[] | PoemLine[];
  onDone?: () => void;
  alreadyRevealed?: boolean;
  allStableIds?: string[];
  variant?: 'reveal' | 'archive';
  metadata?: PoemMetadata;
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function PoemDisplay({
  poemId,
  lines,
  onDone,
  alreadyRevealed = false,
  allStableIds,
  variant = 'reveal',
  metadata,
}: PoemDisplayProps) {
  const isArchive = variant === 'archive';

  // Archive variant is always fully revealed
  const effectiveAlreadyRevealed = isArchive ? true : alreadyRevealed;

  const [revealedCount, setRevealedCount] = useState(
    effectiveAlreadyRevealed ? lines.length : 0
  );
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const { handleShare, copied } = useSharePoem(poemId);

  const normalizedLines: PoemLine[] = lines.map((line) =>
    typeof line === 'string' ? { text: line } : line
  );

  // Get unique authors for legend (preserves order of first appearance)
  const uniqueAuthors = useMemo(() => {
    const seen = new Set<string>();
    return normalizedLines
      .filter((line) => {
        if (!line.authorStableId || seen.has(line.authorStableId)) return false;
        seen.add(line.authorStableId);
        return true;
      })
      .map((line) => ({
        name: line.authorName ?? 'Unknown',
        stableId: line.authorStableId!,
        isBot: line.isBot ?? false,
      }));
  }, [normalizedLines]);

  // Staggered reveal with rhythmic pause after line 4
  useEffect(() => {
    if (!effectiveAlreadyRevealed && revealedCount < lines.length) {
      const extraDelay =
        revealedCount === PAUSE_AFTER_LINE + 1 ? PAUSE_DURATION : 0;
      const delay = BASE_REVEAL_DELAY + extraDelay;

      const timer = setTimeout(() => {
        setRevealedCount((prev) => prev + 1);
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [revealedCount, lines.length, effectiveAlreadyRevealed]);

  // Clear selected line after 2s
  useEffect(() => {
    if (selectedLine !== null) {
      const timer = setTimeout(() => setSelectedLine(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [selectedLine]);

  const allRevealed = revealedCount >= lines.length;

  // Get first line for preview (use metadata or extract from lines)
  const firstLineText = metadata?.firstLine ?? normalizedLines[0]?.text ?? '';

  // Container classes based on variant
  const containerClasses = isArchive
    ? 'min-h-screen bg-background flex flex-col'
    : 'fixed inset-0 bg-background z-50 flex flex-col overflow-y-auto';

  return (
    <div className={containerClasses}>
      {/* Poem Content */}
      <div className="flex-1 px-6 md:px-12 lg:px-24 py-12 md:py-16 lg:py-24 max-w-3xl mx-auto w-full">
        {/* Header: Poem Identity + Controls */}
        {metadata && (
          <header className="mb-12">
            {/* Back link (archive only) */}
            {isArchive && metadata.backHref && (
              <div className="mb-6">
                <Link
                  href={metadata.backHref}
                  className="text-sm font-mono uppercase tracking-widest text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
                >
                  {metadata.backLabel ?? '← Back'}
                </Link>
              </div>
            )}

            {/* Date + Favorite */}
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-mono text-text-muted uppercase tracking-wider">
                {formatDate(metadata.createdAt)}
              </span>
              {isArchive &&
                metadata.isParticipant &&
                metadata.onToggleFavorite && (
                  <button
                    onClick={metadata.onToggleFavorite}
                    className={cn(
                      'transition-colors',
                      metadata.isFavorited
                        ? 'text-[var(--color-primary)]'
                        : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                    )}
                    aria-label={
                      metadata.isFavorited
                        ? 'Remove from favorites'
                        : 'Add to favorites'
                    }
                  >
                    <Heart
                      className="w-6 h-6"
                      fill={metadata.isFavorited ? 'currentColor' : 'none'}
                    />
                  </button>
                )}
            </div>

            {/* Title (first line preview) */}
            <p className="text-xl md:text-2xl font-[var(--font-display)] italic text-text-secondary leading-relaxed mb-4">
              &ldquo;
              {firstLineText.length > 40
                ? `${firstLineText.slice(0, 40)}...`
                : firstLineText}
              &rdquo;
            </p>

            {/* Poets legend - inline */}
            {uniqueAuthors.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm mb-6">
                {uniqueAuthors.map(({ name, stableId, isBot }) => (
                  <div key={stableId} className="flex items-center gap-1.5">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor: allStableIds
                          ? getUniqueColor(stableId, allStableIds)
                          : getUserColor(stableId),
                      }}
                    />
                    <span className="text-text-secondary">
                      {name}
                      {isBot && ' (AI)'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t border-border-subtle" />
          </header>
        )}

        {/* The Poem - Grid with dot gutter */}
        <div className="space-y-6">
          {normalizedLines.map((line, index) => {
            const isVisible = index < revealedCount;
            const isSelected = selectedLine === index;
            const dotColor = line.authorStableId
              ? allStableIds
                ? getUniqueColor(line.authorStableId, allStableIds)
                : getUserColor(line.authorStableId)
              : 'var(--color-text-muted)';

            return (
              <Fragment key={index}>
                <div className="grid grid-cols-[1rem_1fr] gap-4 items-center">
                  {/* Author Dot (Hanko) */}
                  <div
                    role="button"
                    tabIndex={isVisible ? 0 : -1}
                    className={cn(
                      'w-2 h-2 rounded-full cursor-pointer transition-all',
                      'focus:outline-none focus:ring-2 focus:ring-focus-ring focus:ring-offset-2',
                      isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-0'
                    )}
                    style={{ backgroundColor: dotColor }}
                    onClick={() => setSelectedLine(index)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedLine(index);
                      }
                    }}
                    title={line.authorName}
                    aria-label={`Show author for line ${index + 1}`}
                  />

                  {/* Line Text */}
                  <div className="relative">
                    <p
                      className={cn(
                        'font-[var(--font-display)] leading-relaxed',
                        'text-lg md:text-xl lg:text-2xl',
                        'text-text-primary'
                      )}
                      style={{
                        animation: isVisible
                          ? `wipe-reveal 800ms ease-out forwards`
                          : 'none',
                        clipPath: isVisible ? undefined : 'inset(0 100% 0 0)',
                      }}
                    >
                      {line.text}
                    </p>

                    {/* Author byline on tap */}
                    {line.authorName && (
                      <span
                        className={cn(
                          'absolute top-full left-0 text-sm italic text-text-muted',
                          'transition-opacity duration-300',
                          isSelected ? 'opacity-100' : 'opacity-0'
                        )}
                      >
                        — {line.authorName}
                        {line.isBot && ' (AI)'}
                      </span>
                    )}
                  </div>
                </div>
              </Fragment>
            );
          })}
        </div>
      </div>

      {/* Footer / Actions - Fixed at bottom */}
      <div
        className={cn(
          'px-6 md:px-12 lg:px-24 py-6 border-t border-border-subtle',
          'flex items-center justify-center gap-4',
          'transition-opacity duration-500',
          allRevealed ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
      >
        <Button
          onClick={handleShare}
          variant="primary"
          size="lg"
          className="min-w-[140px] h-12"
          stampAnimate={copied}
        >
          {copied ? 'Copied!' : 'Share'}
        </Button>
        {/* Reveal variant: Close button; Archive variant: navigation handles close */}
        {!isArchive && onDone && (
          <Button
            onClick={onDone}
            variant="ghost"
            size="lg"
            className="min-w-[100px] h-12 text-text-muted hover:text-text-primary"
          >
            Close
          </Button>
        )}
      </div>
    </div>
  );
}
