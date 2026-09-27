'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Download, Heart } from 'lucide-react';
import { Button } from './ui/Button';
import { Alert } from './ui/Alert';
import { Avatar } from './ui/Avatar';
import { HeartButton } from './ui/HeartButton';
import { E2E_TEST_IDS } from '@/lib/e2eTestIds';
import { cn } from '@/lib/utils';
import type { AvatarId } from '@/lib/avatars';
import { Id } from '@/convex/_generated/dataModel';
import {
  useSharePoem,
  type UseSharePoemDependencies,
} from '@/hooks/useSharePoem';
import { useSavePoemImage } from '@/hooks/useSavePoemImage';
import { SoundControl } from './SoundControl';
import { playSound } from '@/lib/audio';
import { errorToFeedback } from '@/lib/errorFeedback';
import { toErrorReportable } from '@/lib/errorCore';

export interface PoemLine {
  text: string;
  authorName?: string;
  authorStableId?: string;
}

export interface PoemMetadata {
  createdAt: number;
  firstLine?: string;
  isParticipant?: boolean;
  isFavorited?: boolean;
  isPublic?: boolean;
  onToggleFavorite?: () => void;
  onRevokeShare?: () => void | Promise<void>;
  backHref?: string;
  backLabel?: string;
  uniquePoets?: number;
  readerName?: string;
  readerStableId?: string;
  readerAvatarId?: AvatarId;
  poemNumber?: number;
}

export interface PoemDisplayProps {
  poemId: Id<'poems'>;
  guestToken?: string;
  lines: PoemLine[];
  onDone?: () => void;
  alreadyRevealed?: boolean;
  readOnly?: boolean;
  allStableIds?: string[];
  variant?: 'reveal' | 'archive';
  metadata?: PoemMetadata;
  roomId?: string;
  cycle?: number;
  shareDependencies?: UseSharePoemDependencies;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function PoemDisplay({
  poemId,
  guestToken,
  lines,
  readOnly = false,
  onDone,
  allStableIds,
  variant = 'reveal',
  metadata,
  roomId,
  cycle = 1,
  shareDependencies,
}: PoemDisplayProps) {
  const isArchive = variant === 'archive';
  const firstLineText = lines[0]?.text ?? metadata?.firstLine ?? '';
  const dialogRef = useRef<HTMLDivElement>(null);
  const poemHeadingRef = useRef<HTMLHeadingElement>(null);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);
  const [isSharing, setIsSharing] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [revoked, setRevoked] = useState(false);
  const { handleShare, revokeShare, copied, shared, shareError } = useSharePoem(
    poemId,
    guestToken,
    firstLineText,
    roomId,
    cycle,
    shareDependencies
  );
  const { handleSaveImage, saving, saved, saveError } = useSavePoemImage(
    poemId,
    guestToken,
    roomId,
    cycle
  );

  useEffect(() => {
    if (isArchive) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    poemHeadingRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onDoneRef.current?.();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])'
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      const isControl = Array.from(focusable).some(
        (element) => element === active
      );
      if (event.shiftKey && (active === first || !isControl)) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && (active === last || !isControl)) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus();
      }
    };
  }, [isArchive, poemId]);

  const handlePublish = async () => {
    if (isSharing || isRevoking) return;
    setIsSharing(true);
    setRevokeError(null);
    setRevoked(false);
    try {
      await handleShare();
    } finally {
      setIsSharing(false);
    }
  };

  const handleRevoke = async () => {
    if (isSharing || isRevoking) return;
    setIsRevoking(true);
    setRevokeError(null);
    try {
      if (metadata?.onRevokeShare) await metadata.onRevokeShare();
      else await revokeShare();
      setRevoked(true);
      playSound('success');
    } catch (cause) {
      playSound('error');
      setRevokeError(errorToFeedback(toErrorReportable(cause)).message);
    } finally {
      setIsRevoking(false);
    }
  };

  const shareStatus = revoked
    ? 'Public poem link revoked.'
    : shared
      ? 'Poem shared.'
      : copied
        ? 'Poem link copied.'
        : null;
  const title = metadata?.poemNumber ? `Poem ${metadata.poemNumber}` : 'Poem';

  return (
    <div
      ref={dialogRef}
      role={!isArchive ? 'dialog' : undefined}
      aria-modal={!isArchive ? true : undefined}
      aria-labelledby="poem-display-title"
      className={cn(
        'bg-background font-sans text-text-primary',
        isArchive
          ? 'lj-game-viewport'
          : 'lj-game-frame lj-viewport-offset fixed inset-0 z-50 overflow-y-auto overflow-x-hidden'
      )}
    >
      {!isArchive && (
        <p role="status" aria-live="polite" className="sr-only">
          {title} revealed.
        </p>
      )}
      <main className="lj-safe-inline mx-auto w-full max-w-3xl pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:py-8">
        {isArchive && metadata?.backHref && (
          <Link
            href={metadata.backHref}
            className="mb-4 inline-flex min-h-11 items-center text-sm font-semibold text-text-secondary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus-ring print:hidden"
          >
            {metadata.backLabel ?? 'Back'}
          </Link>
        )}
        <article className="poem-print-surface rounded-3xl bg-surface p-5 sm:p-8">
          <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              {metadata?.readerName && metadata.readerStableId && (
                <Avatar
                  stableId={metadata.readerStableId}
                  displayName={metadata.readerName}
                  avatarId={metadata.readerAvatarId}
                  allStableIds={allStableIds}
                  size="md"
                />
              )}
              <div className="min-w-0">
                <h1
                  id="poem-display-title"
                  ref={poemHeadingRef}
                  tabIndex={-1}
                  className="text-xl font-bold leading-snug focus:outline-none sm:text-2xl"
                >
                  {title}
                </h1>
                {metadata?.readerName && (
                  <p className="break-words text-sm text-text-secondary">
                    Read by {metadata.readerName}
                  </p>
                )}
                {isArchive && metadata && (
                  <p className="text-sm text-text-muted">
                    {formatDate(metadata.createdAt)}
                  </p>
                )}
              </div>
            </div>
            {!isArchive && <SoundControl />}
            {isArchive &&
              metadata?.isParticipant &&
              metadata.onToggleFavorite && (
                <button
                  type="button"
                  onClick={metadata.onToggleFavorite}
                  data-sound="loading"
                  className={cn(
                    'inline-flex min-h-11 min-w-11 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring print:hidden',
                    metadata.isFavorited
                      ? 'text-primary'
                      : 'text-text-secondary hover:text-primary'
                  )}
                  aria-label={
                    metadata.isFavorited
                      ? 'Remove from favorites'
                      : 'Add to favorites'
                  }
                >
                  <Heart
                    className="h-5 w-5"
                    aria-hidden="true"
                    fill={metadata.isFavorited ? 'currentColor' : 'none'}
                  />
                </button>
              )}
          </header>

          <ol aria-label="Poem lines" className="space-y-3">
            {lines.map((line, index) => (
              <li
                key={index}
                className="grid items-baseline gap-x-6 sm:grid-cols-[minmax(0,1fr)_minmax(5rem,0.3fr)]"
              >
                <p className="min-w-0 whitespace-pre-wrap text-xl not-italic leading-relaxed [overflow-wrap:anywhere] sm:text-2xl">
                  {line.text}
                </p>
                {(line.authorName || line.authorStableId) && (
                  <span className="min-w-0 text-sm leading-relaxed text-text-secondary [overflow-wrap:anywhere]">
                    <span className="sr-only">Written by </span>
                    {line.authorName || 'Unknown'}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </article>

        <div
          data-testid={E2E_TEST_IDS.poemActions}
          className="mt-5 space-y-4 print:hidden"
        >
          {!isArchive && (
            <div className="flex flex-wrap items-center gap-3">
              {onDone && (
                <Button
                  onClick={onDone}
                  data-sound="droplet"
                  data-testid={E2E_TEST_IDS.poemDoneButton}
                  size="lg"
                  className="min-h-12 flex-1 sm:flex-none sm:min-w-32"
                >
                  Done
                </Button>
              )}
              {!readOnly && (
                <HeartButton poemId={poemId} guestToken={guestToken} />
              )}
            </div>
          )}
          {(shareError || saveError || revokeError) && (
            <Alert variant="error">
              {revokeError || shareError || saveError}
            </Alert>
          )}
          {!readOnly && (
            <>
              <p
                id="poem-share-disclosure"
                className="text-sm text-text-secondary"
              >
                Sharing makes this poem public to anyone with the link.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={handleSaveImage}
                  data-sound="loading"
                  data-testid={E2E_TEST_IDS.poemSaveImageButton}
                  variant="outline"
                  disabled={saving}
                  className="min-h-11"
                >
                  <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                  {saving ? 'Saving...' : saved ? 'Saved' : 'Save image'}
                </Button>
                <Button
                  onClick={handlePublish}
                  data-sound="loading"
                  variant="outline"
                  disabled={isSharing || isRevoking}
                  aria-describedby="poem-share-disclosure"
                  className="min-h-11"
                >
                  {isSharing ? 'Sharing...' : 'Share poem'}
                </Button>
                {isArchive && (
                  <Button
                    onClick={() => window.print()}
                    variant="ghost"
                    className="min-h-11"
                  >
                    Print
                  </Button>
                )}
                {(!isArchive || metadata?.isParticipant) && (
                  <Button
                    onClick={handleRevoke}
                    data-sound="loading"
                    variant="ghost"
                    disabled={isSharing || isRevoking}
                    className="min-h-11 text-text-secondary"
                  >
                    {isRevoking ? 'Revoking...' : 'Revoke public link'}
                  </Button>
                )}
              </div>
            </>
          )}
          {shareStatus && (
            <p role="status" className="text-sm text-primary">
              {shareStatus}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
