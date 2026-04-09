'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Archive, Palette, Share2 } from 'lucide-react';
import { HelpModal } from './HelpModal';
import { ThemeSelector } from './ThemeSelector';
import { Alert } from './ui/Alert';
import { cn } from '@/lib/utils';
import { useShareLink } from '@/hooks/useShareLink';
import { trackRoomInviteShared } from '@/lib/analytics';
import { formatRoomCode } from '@/lib/roomCode';

interface RoomChromeProps {
  roomCode: string;
  statusLabel: string;
  title: string;
  subtitle: string;
}

function chromeButtonClasses({
  emphasized = false,
  iconOnly = false,
}: {
  emphasized?: boolean;
  iconOnly?: boolean;
} = {}) {
  return cn(
    'inline-flex h-11 items-center justify-center rounded-full border',
    'transition-all duration-[var(--duration-normal)]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2',
    iconOnly ? 'w-11' : 'px-4',
    emphasized
      ? 'border-primary bg-primary text-text-inverse hover:bg-primary-hover'
      : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]'
  );
}

export function RoomChrome({
  roomCode,
  statusLabel,
  title,
  subtitle,
}: RoomChromeProps) {
  const [showThemes, setShowThemes] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { handleShare, copied, shared, shareError } = useShareLink({
    getShareData: () => ({
      url: `${window.location.origin}/join?code=${roomCode}`,
      title: 'Join my Linejam room',
      text: `Join my Linejam room with code ${roomCode}.`,
    }),
    onShared: (method) => {
      trackRoomInviteShared({ method, roomCode });
    },
    failureMessage: 'Failed to share invite. Please try again.',
  });

  useEffect(() => {
    if (!showThemes) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowThemes(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowThemes(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showThemes]);

  return (
    <>
      <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />

      <div className="sticky top-0 z-40 px-4 pt-3 md:px-6">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3">
          {shareError && (
            <Alert
              variant="error"
              className="max-w-xl bg-[var(--color-surface)]/95 shadow-[var(--shadow-lg)] backdrop-blur"
            >
              {shareError}
            </Alert>
          )}

          <div
            data-testid="room-chrome"
            className="grid gap-3 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)]/92 px-4 py-3 shadow-[var(--shadow-lg)] backdrop-blur-xl md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:px-6"
          >
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-background)]/72 px-3 py-1 text-[11px] font-mono uppercase tracking-[0.32em] text-[var(--color-text-muted)]">
                  Room {formatRoomCode(roomCode)}
                </span>
                <span className="rounded-full border border-[var(--color-border-subtle)] px-3 py-1 text-[11px] font-mono uppercase tracking-[0.28em] text-[var(--color-text-secondary)]">
                  {statusLabel}
                </span>
              </div>

              <div className="space-y-0.5">
                <h1 className="truncate text-xl font-[var(--font-display)] font-medium leading-tight text-[var(--color-text-primary)] md:text-2xl">
                  {title}
                </h1>
                <p className="max-w-3xl text-sm leading-relaxed text-[var(--color-text-secondary)]">
                  {subtitle}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 md:justify-end">
              <button
                type="button"
                onClick={handleShare}
                className={chromeButtonClasses({ emphasized: true })}
                aria-label="Share room invite"
              >
                <Share2 className="mr-2 h-4 w-4" />
                <span>
                  {shared ? 'Shared!' : copied ? 'Copied!' : 'Invite'}
                </span>
              </button>

              <Link
                href="/me/poems"
                className={chromeButtonClasses({ iconOnly: true })}
                aria-label="View your poem archive"
              >
                <Archive className="h-4 w-4" />
              </Link>

              <button
                type="button"
                onClick={() => setShowHelp(true)}
                className={chromeButtonClasses({ iconOnly: true })}
                aria-label="How to play"
              >
                <span className="text-lg font-medium">?</span>
              </button>

              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setShowThemes((current) => !current)}
                  className={chromeButtonClasses({ iconOnly: true })}
                  aria-label="Choose theme"
                  aria-expanded={showThemes}
                  aria-haspopup="true"
                >
                  <Palette className="h-4 w-4" />
                </button>

                {showThemes && (
                  <div className="absolute right-0 top-full z-50 mt-3 w-[320px] max-w-[calc(100vw-2rem)] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-lg)]">
                    <ThemeSelector onClose={() => setShowThemes(false)} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
