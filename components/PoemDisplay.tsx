'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Download, Heart, Volume2, VolumeX } from 'lucide-react';
import { Button } from './ui/Button';
import { Alert } from './ui/Alert';
import { HeartButton } from './ui/HeartButton';
import { E2E_TEST_IDS } from '@/lib/e2eTestIds';
import { cn } from '@/lib/utils';
import { Id } from '@/convex/_generated/dataModel';
import { useSharePoem } from '@/hooks/useSharePoem';
import { useSavePoemImage } from '@/hooks/useSavePoemImage';
import { useCeremonyEffects } from '@/hooks/useCeremonyEffects';
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

const REVEAL_DELAYS_MS = [560, 680, 800, 940, 1120, 900, 720, 520, 360];

function getRevealDelay(lineIndex: number, totalLines: number) {
  if (totalLines <= 1) return REVEAL_DELAYS_MS[0];
  const shapeIndex = Math.round(
    (lineIndex / Math.max(totalLines - 1, 1)) * (REVEAL_DELAYS_MS.length - 1)
  );
  return REVEAL_DELAYS_MS[shapeIndex] ?? REVEAL_DELAYS_MS.at(-1)!;
}

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
  guestToken?: string;
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
  guestToken,
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
  const normalizedLines: PoemLine[] = lines.map((line) =>
    typeof line === 'string' ? { text: line } : line
  );
  const firstLineText = normalizedLines[0]?.text ?? metadata?.firstLine ?? '';
  // Law 3: line number gutter is one fixed width for every line (ch units,
  // sized to the poem's line count) so line text always starts at the same
  // x — no line's number or author dot can nudge the text that follows it.
  const lineNumberGutterWidth = `${String(normalizedLines.length).length + 1}ch`;
  const lineGridTemplate = `${lineNumberGutterWidth} 2.75rem 1fr`;
  const { isMuted, prefersReducedMotion, punctuate, toggleMuted } =
    useCeremonyEffects();

  const [revealedCount, setRevealedCount] = useState(
    effectiveAlreadyRevealed || prefersReducedMotion ? lines.length : 0
  );
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const { handleShare, copied, shared, shareError } = useSharePoem(
    poemId,
    guestToken,
    firstLineText
  );
  const { handleSaveImage, saving, saved, saveError } = useSavePoemImage(
    poemId,
    guestToken
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

  // Staggered reveal follows the 1,2,3,4,5,4,3,2,1 poem shape, then
  // accelerates into the final one-word line.
  useEffect(() => {
    if (effectiveAlreadyRevealed || prefersReducedMotion) {
      if (revealedCount < lines.length) {
        const timer = setTimeout(() => {
          setRevealedCount(lines.length);
        }, 0);
        return () => clearTimeout(timer);
      }
      return;
    }

    if (revealedCount < lines.length) {
      const delay = getRevealDelay(revealedCount, lines.length);
      const timer = setTimeout(() => {
        const nextCount = revealedCount + 1;
        punctuate(nextCount >= lines.length ? 'final-line' : 'line');
        setRevealedCount(nextCount);
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [
    revealedCount,
    lines.length,
    effectiveAlreadyRevealed,
    prefersReducedMotion,
    punctuate,
  ]);

  // Clear selected line after 2s
  useEffect(() => {
    if (selectedLine !== null) {
      const timer = setTimeout(() => setSelectedLine(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [selectedLine]);

  const allRevealed = revealedCount >= lines.length;
  const shareStatus = shared
    ? 'Poem shared.'
    : copied
      ? 'Poem link copied.'
      : null;

  // Container classes based on variant
  const containerClasses = isArchive
    ? 'lj-game-viewport bg-background flex flex-col'
    : 'lj-game-frame lj-viewport-offset fixed inset-0 bg-background z-50 flex flex-col overflow-y-auto overflow-x-hidden';

  const ceremonyMuteButton = !isArchive ? (
    <button
      type="button"
      onClick={toggleMuted}
      className="inline-flex h-9 items-center gap-2 rounded-full border border-border-subtle bg-background/80 px-3 text-xs font-mono uppercase tracking-wider text-text-muted backdrop-blur-sm transition-colors hover:border-primary hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      aria-label={isMuted ? 'Turn ceremony sound on' : 'Mute ceremony sound'}
      title={isMuted ? 'Turn ceremony sound on' : 'Mute ceremony'}
    >
      {isMuted ? (
        <VolumeX className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Volume2 className="h-4 w-4" aria-hidden="true" />
      )}
      <span>{isMuted ? 'Muted' : 'Sound'}</span>
    </button>
  ) : null;

  return (
    <div className={containerClasses}>
      {!metadata && ceremonyMuteButton && (
        <div className="fixed right-[max(1rem,env(safe-area-inset-right))] top-[max(1rem,env(safe-area-inset-top))] z-10 print:hidden">
          {ceremonyMuteButton}
        </div>
      )}

      {/* Poem Content */}
      <div className="lj-safe-inline mx-auto w-full max-w-3xl flex-1 pt-[max(3rem,env(safe-area-inset-top))] pb-[max(3rem,env(safe-area-inset-bottom))] md:[--lj-safe-inline-space:3rem] md:py-16 lg:[--lj-safe-inline-space:6rem] lg:py-24">
        {/* Header: Poem Identity + Controls */}
        {metadata && (
          <header className="mb-12">
            {/* Back link (archive only) */}
            {isArchive && metadata.backHref && (
              <div className="mb-6 print:hidden">
                <Link
                  href={metadata.backHref}
                  className="text-sm font-mono uppercase tracking-widest text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
                >
                  {metadata.backLabel ?? '← Back'}
                </Link>
              </div>
            )}

            {/* Performance-toned kicker — the ceremony read is a group
                moment, not silent reading. */}
            {!isArchive && (
              <p className="mb-2 text-xs font-mono uppercase tracking-widest text-primary">
                Read it aloud
              </p>
            )}

            {/* Date + Favorite */}
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-mono text-text-muted uppercase tracking-wider">
                {formatDate(metadata.createdAt)}
              </span>
              {!isArchive && ceremonyMuteButton}
              {isArchive &&
                metadata.isParticipant &&
                metadata.onToggleFavorite && (
                  <button
                    onClick={metadata.onToggleFavorite}
                    className={cn(
                      'print:hidden transition-colors',
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
            const isFinalLine = index === normalizedLines.length - 1;
            const revealAnimation =
              isVisible && !prefersReducedMotion
                ? isFinalLine
                  ? 'wipe-reveal 800ms ease-out forwards, final-line-settle 700ms cubic-bezier(0.22, 1, 0.36, 1) forwards'
                  : 'wipe-reveal 800ms ease-out forwards'
                : 'none';
            const dotColor = line.authorStableId
              ? allStableIds
                ? getUniqueColor(line.authorStableId, allStableIds)
                : getUserColor(line.authorStableId)
              : 'var(--color-text-muted)';

            return (
              <Fragment key={index}>
                <div
                  className="grid items-center"
                  style={{ gridTemplateColumns: lineGridTemplate }}
                >
                  {/* Line number — fixed gutter, same width on every line
                      (Law 3). Decorative: the reading order is already
                      conveyed by document order. */}
                  <span
                    className="pr-2 text-right font-mono text-xs tabular-nums text-text-muted"
                    aria-hidden="true"
                  >
                    {index + 1}
                  </span>

                  {/* Author Dot (Hanko) — 8px ink mark inside a 44px tap target */}
                  <button
                    type="button"
                    tabIndex={isVisible ? 0 : -1}
                    disabled={!isVisible}
                    className={cn(
                      'flex h-11 w-11 items-center justify-center rounded-full',
                      '-ml-1.5 cursor-pointer transition-opacity',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
                      isVisible ? 'opacity-100' : 'opacity-0'
                    )}
                    onClick={() => setSelectedLine(index)}
                    title={line.authorName}
                    aria-label={`Show author for line ${index + 1}`}
                  >
                    <span
                      className="block h-2 w-2 rounded-full"
                      style={{ backgroundColor: dotColor }}
                    />
                  </button>

                  {/* Line Text */}
                  <div className="relative">
                    <p
                      className={cn(
                        'font-[var(--font-display)] leading-relaxed',
                        'text-lg md:text-xl lg:text-2xl',
                        'text-text-primary',
                        isVisible &&
                          isFinalLine &&
                          !prefersReducedMotion &&
                          'animate-final-line-settle'
                      )}
                      style={{
                        animation: revealAnimation,
                        clipPath: isVisible ? undefined : 'inset(0 100% 0 0)',
                      }}
                    >
                      {line.text}
                    </p>

                    {/* Author byline.
                        AI lines get their persona moment: the name announces
                        itself the instant the line reveals (the persona is part
                        of the comedy). Human authors stay hidden until tapped. */}
                    {line.authorName && (
                      <span
                        className={cn(
                          'absolute top-full left-0 text-sm italic',
                          'transition-opacity duration-500',
                          line.isBot ? 'text-primary' : 'text-text-muted',
                          isSelected || (line.isBot && isVisible)
                            ? 'opacity-100'
                            : 'opacity-0'
                        )}
                      >
                        {line.isBot ? '✦ ' : '— '}
                        {line.authorName}
                        {line.isBot && ' writes'}
                      </span>
                    )}
                  </div>
                </div>
              </Fragment>
            );
          })}
        </div>
      </div>

      {/* Footer / Actions — in flow so expanded copy cannot cover the poem. */}
      <div
        data-testid={E2E_TEST_IDS.poemActions}
        className={cn(
          'print:hidden px-space-3 py-space-3 md:px-space-5 lg:px-space-6 border-t border-border-subtle',
          'flex flex-col items-center gap-space-3',
          'transition-opacity duration-500',
          allRevealed ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
      >
        {(shareError || saveError) && (
          <Alert variant="error" className="w-full max-w-md">
            {shareError || saveError}
          </Alert>
        )}
        {!isArchive && (
          <p className="max-w-md text-center text-sm text-text-muted">
            Loved this one? Give it a heart — the room favorite gets crowned in
            the recap.
          </p>
        )}
        <p className="max-w-md text-center text-sm text-text-muted">
          Sharing makes this poem public to anyone with the link.
        </p>
        <div className="flex w-full max-w-md flex-wrap items-center justify-center gap-space-2 sm:gap-space-3">
          {/* Reveal variant: heart the poem toward the room-favorite crown */}
          {!isArchive && (
            <HeartButton poemId={poemId} guestToken={guestToken} />
          )}
          <Button
            onClick={handleShare}
            variant="primary"
            size="lg"
            className="h-12 min-w-[120px] flex-1"
            stampAnimate={copied}
          >
            {shared ? 'Shared!' : copied ? 'Copied!' : 'Share'}
          </Button>
          <Button
            onClick={handleSaveImage}
            data-testid={E2E_TEST_IDS.poemSaveImageButton}
            variant="outline"
            size="lg"
            className="h-12 min-w-[120px] flex-1"
            disabled={saving}
          >
            <Download className="mr-2 h-4 w-4" aria-hidden="true" />
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save image'}
          </Button>
          {/* Print stylesheet lives in app/globals.css; only the archive
              page (a stable, linkable poem) offers a Print action. */}
          {isArchive && (
            <Button
              onClick={() => window.print()}
              variant="ghost"
              size="lg"
              className="min-w-[100px] h-12"
            >
              Print
            </Button>
          )}
          {/* Reveal variant: Close button; Archive variant: navigation handles close */}
          {!isArchive && onDone && (
            <Button
              onClick={onDone}
              data-testid={E2E_TEST_IDS.poemDoneButton}
              variant="ghost"
              size="lg"
              className="min-w-[100px] h-12 text-text-muted hover:text-text-primary"
            >
              Done
            </Button>
          )}
        </div>
        {shareStatus && (
          <p
            role="status"
            className="text-center text-xs font-mono uppercase tracking-widest text-primary"
          >
            {shareStatus}
          </p>
        )}
      </div>
    </div>
  );
}
