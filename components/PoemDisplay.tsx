'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
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
 * - Whole-poem presentation with a deliberate reading order
 * - Poem identity: date + first line preview + contributor dots
 *
 * Variants:
 * - 'reveal': Full-screen overlay for post-game reveal (default)
 * - 'archive': Regular page flow for archive viewing
 */

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
  isPublic?: boolean;
  onToggleFavorite?: () => void;
  onRevokeShare?: () => void | Promise<void>;
  backHref?: string;
  backLabel?: string;
  uniquePoets?: number;
  readerName?: string;
  poemNumber?: number;
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
  roomId?: string;
  cycle?: number;
  playerKind?: 'human' | 'AI';
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
  allStableIds,
  variant = 'reveal',
  metadata,
  roomId,
  cycle = 1,
  playerKind = 'human',
}: PoemDisplayProps) {
  const isArchive = variant === 'archive';

  const normalizedLines: PoemLine[] = lines.map((line) =>
    typeof line === 'string' ? { text: line } : line
  );
  const firstLineText = normalizedLines[0]?.text ?? metadata?.firstLine ?? '';
  // Law 3: line number gutter is one fixed width for every line (ch units,
  // sized to the poem's line count) so line text always starts at the same
  // x — no line's number or author dot can nudge the text that follows it.
  const lineNumberGutterWidth = `${String(normalizedLines.length).length + 1}ch`;
  const lineGridTemplate = `${lineNumberGutterWidth} 2.75rem 1fr`;
  const { isMuted, toggleMuted } = useCeremonyEffects();
  const poemHeadingRef = useRef<HTMLHeadingElement>(null);
  const announcement = isArchive
    ? ''
    : metadata?.readerName && metadata.poemNumber
      ? metadata.readerName +
        ', poem ' +
        metadata.poemNumber +
        ' is ready. Read from line one.'
      : 'Poem revealed. Read from line one.';
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const { handleShare, copied, shared, shareError } = useSharePoem(
    poemId,
    guestToken,
    firstLineText,
    roomId,
    cycle,
    playerKind
  );
  const { handleSaveImage, saving, saved, saveError } = useSavePoemImage(
    poemId,
    guestToken,
    roomId,
    cycle,
    playerKind
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

  // The ceremony presents each poem as one composition. Focus the reading
  // target and announce only the transition, never the poem text itself.
  useEffect(() => {
    if (isArchive) return;
    poemHeadingRef.current?.focus();
  }, [isArchive, poemId]);

  // Clear selected line after 2s
  useEffect(() => {
    if (selectedLine !== null) {
      const timer = setTimeout(() => setSelectedLine(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [selectedLine]);

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
      className="inline-flex h-11 min-w-11 items-center gap-2 rounded-full border border-border-subtle bg-background/80 px-3 text-xs font-mono uppercase tracking-wider text-text-muted backdrop-blur-sm transition-colors hover:border-primary hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
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
      <div
        className="lj-safe-inline mx-auto w-full max-w-3xl flex-1 pt-[max(3rem,env(safe-area-inset-top))] pb-[max(3rem,env(safe-area-inset-bottom))] md:[--lj-safe-inline-space:3rem] md:py-16 lg:[--lj-safe-inline-space:6rem] lg:py-24"
        aria-labelledby={!isArchive ? 'poem-display-title' : undefined}
      >
        {!isArchive && (
          <>
            <h1
              id="poem-display-title"
              ref={poemHeadingRef}
              tabIndex={-1}
              className="sr-only"
            >
              Poem ready to read
            </h1>
            <p
              role="status"
              aria-live="polite"
              aria-label={announcement}
              className="sr-only"
            >
              {announcement}
            </p>
          </>
        )}
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
                      'print:hidden inline-flex min-h-11 min-w-11 items-center justify-center transition-colors',
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

            {isArchive &&
              metadata.isParticipant &&
              metadata.isPublic &&
              metadata.onRevokeShare && (
                <button
                  type="button"
                  onClick={() => void metadata.onRevokeShare?.()}
                  className="mb-4 text-xs font-mono uppercase tracking-widest text-text-muted underline hover:text-text-primary"
                >
                  Revoke public link
                </button>
              )}

            {/* Title (first line preview) */}
            <p className="text-xl md:text-2xl font-[var(--font-display)] italic text-text-secondary leading-relaxed mb-4">
              &ldquo;
              {firstLineText.length > 40
                ? `${firstLineText.slice(0, 40)}...`
                : firstLineText}
              &rdquo;
            </p>

            {/* Poets legend - archive exposes all authors; reveal only names AI
                is intentionally announcing at the moment they appear. */}
            {(isArchive
              ? uniqueAuthors
              : uniqueAuthors.filter(({ isBot }) => isBot)
            ).length > 0 && (
              <div
                role="list"
                aria-label="Poem contributors"
                className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm mb-6"
              >
                {(isArchive
                  ? uniqueAuthors
                  : uniqueAuthors.filter(({ isBot }) => isBot)
                ).map(({ name, stableId, isBot }) => (
                  <div
                    key={stableId}
                    role="listitem"
                    className="flex items-center gap-1.5"
                  >
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
            const isSelected = selectedLine === index;
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
                    tabIndex={0}
                    className={cn(
                      'flex h-11 w-11 items-center justify-center rounded-full',
                      '-ml-1.5 cursor-pointer transition-opacity',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
                      'opacity-100'
                    )}
                    onClick={() => setSelectedLine(index)}
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
                        'text-text-primary'
                      )}
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
                          isSelected || line.isBot ? 'opacity-100' : 'opacity-0'
                        )}
                        aria-hidden={!isSelected && !line.isBot}
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
          'print:hidden px-space-3 pt-space-3 pb-[max(var(--space-3),env(safe-area-inset-bottom))] md:px-space-5 lg:px-space-6 border-t border-border-subtle',
          'flex flex-col items-center gap-space-3',
          'transition-opacity duration-500 opacity-100'
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
