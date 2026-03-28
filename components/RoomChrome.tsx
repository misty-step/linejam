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

interface RoomChromeProps {
  roomCode: string;
}

function chromeButtonClasses(emphasized = false) {
  return cn(
    'inline-flex h-10 items-center justify-center rounded-full border px-3',
    'transition-all duration-[var(--duration-normal)]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2',
    emphasized
      ? 'border-primary bg-primary text-text-inverse hover:bg-primary-hover'
      : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]'
  );
}

export function RoomChrome({ roomCode }: RoomChromeProps) {
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

      <div className="pointer-events-none fixed right-4 top-4 z-50 flex max-w-[calc(100vw-2rem)] flex-col items-end gap-2">
        {shareError && (
          <Alert
            variant="error"
            className="pointer-events-auto max-w-sm bg-[var(--color-surface)]/95 shadow-[var(--shadow-lg)] backdrop-blur"
          >
            {shareError}
          </Alert>
        )}

        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/92 p-2 shadow-[var(--shadow-lg)] backdrop-blur">
          <button
            type="button"
            onClick={handleShare}
            className={chromeButtonClasses(true)}
            aria-label="Share room invite"
          >
            <Share2 className="mr-2 h-4 w-4" />
            <span>{shared ? 'Shared!' : copied ? 'Copied!' : 'Invite'}</span>
          </button>

          <Link
            href="/me/poems"
            className={chromeButtonClasses()}
            aria-label="View your poem archive"
          >
            <Archive className="h-4 w-4" />
          </Link>

          <button
            type="button"
            onClick={() => setShowHelp(true)}
            className={chromeButtonClasses()}
            aria-label="How to play"
          >
            <span className="text-lg font-medium">?</span>
          </button>

          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setShowThemes((current) => !current)}
              className={chromeButtonClasses()}
              aria-label="Choose theme"
              aria-expanded={showThemes}
              aria-haspopup="true"
            >
              <Palette className="h-4 w-4" />
            </button>

            {showThemes && (
              <div className="absolute right-0 top-full mt-2 w-[320px] max-w-[calc(100vw-2rem)] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-lg)]">
                <ThemeSelector onClose={() => setShowThemes(false)} />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
