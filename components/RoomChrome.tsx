'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  Archive,
  HelpCircle,
  MoreHorizontal,
  Palette,
  Share2,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { HelpModal } from './HelpModal';
import { ThemeSelector } from './ThemeSelector';
import { Alert } from './ui/Alert';
import { cn } from '@/lib/utils';
import { useShareLink } from '@/hooks/useShareLink';
import { trackRoomInviteShared } from '@/lib/analytics';
import { formatRoomCode } from '@/lib/roomCode';

interface RoomChromeProps {
  roomCode: string;
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

const menuItemClasses =
  'flex w-full items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2 text-left text-sm text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-background)] focus-visible:outline-none focus-visible:bg-[var(--color-background)]';

export function RoomChrome({ roomCode, title, subtitle }: RoomChromeProps) {
  const [showThemes, setShowThemes] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
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

  const joinUrl = `${window.location.origin}/join?code=${roomCode}`;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      // Clipboard unavailable — no-op
    }
  };

  // Close the overflow menu / theme panel / QR on outside click or Escape.
  useEffect(() => {
    if (!showMenu && !showThemes && !showQr) return;

    const closeAll = () => {
      setShowMenu(false);
      setShowThemes(false);
      setShowQr(false);
    };
    const handlePointer = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        closeAll();
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeAll();
        menuTriggerRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showMenu, showThemes, showQr]);

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
            className="grid gap-2 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)]/92 px-4 py-3 shadow-[var(--shadow-lg)] backdrop-blur-xl md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:px-5"
          >
            <div className="min-w-0 space-y-1">
              <div className="flex min-w-0 items-center gap-2">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setShowQr((current) => !current);
                      setShowThemes(false);
                      setShowMenu(false);
                    }}
                    className="shrink-0 rounded-full border border-[var(--color-border)] bg-[var(--color-background)]/72 px-2.5 py-0.5 text-[11px] font-mono uppercase tracking-[0.28em] text-[var(--color-text-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors cursor-pointer"
                    aria-label={`Room code ${formatRoomCode(roomCode)} — tap to copy or scan QR`}
                  >
                    Room {formatRoomCode(roomCode)}
                  </button>

                  {showQr && (
                    <div className="absolute left-0 top-full z-50 mt-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-lg)]">
                      <div className="flex flex-col items-center gap-3">
                        <QRCodeSVG
                          value={joinUrl}
                          size={160}
                          level="M"
                          fgColor="var(--color-text-primary)"
                          bgColor="transparent"
                        />
                        <div className="flex items-center gap-2 w-full">
                          <button
                            type="button"
                            onClick={() => {
                              void handleCopyCode();
                            }}
                            className="flex-1 rounded-full border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-1.5 text-xs font-mono uppercase tracking-wider text-[var(--color-text-primary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors cursor-pointer"
                          >
                            {codeCopied ? 'Copied!' : `Copy ${roomCode}`}
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowQr(false)}
                            className="shrink-0 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] p-1.5"
                            aria-label="Close QR"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <h1 className="truncate text-base font-[var(--font-display)] font-medium leading-tight text-[var(--color-text-primary)] md:text-lg">
                  {title}
                </h1>
              </div>
              {subtitle && (
                <p className="max-w-3xl text-sm leading-relaxed text-[var(--color-text-secondary)]">
                  {subtitle}
                </p>
              )}
            </div>

            <div
              ref={menuRef}
              className="flex items-center gap-2 md:justify-end"
            >
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

              <button
                type="button"
                onClick={() => setShowHelp(true)}
                className={chromeButtonClasses({ iconOnly: true })}
                aria-label="How to play"
              >
                <HelpCircle className="h-4 w-4" />
              </button>

              <div className="relative">
                <button
                  ref={menuTriggerRef}
                  type="button"
                  onClick={() => {
                    setShowThemes(false);
                    setShowQr(false);
                    setShowMenu((current) => !current);
                  }}
                  className={chromeButtonClasses({ iconOnly: true })}
                  aria-label="More options"
                  aria-haspopup="true"
                  aria-expanded={showMenu}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>

                {showMenu && (
                  <div className="absolute right-0 top-full z-50 mt-3 w-56 max-w-[calc(100vw-2rem)] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5 shadow-[var(--shadow-lg)]">
                    <Link
                      href="/me/poems"
                      prefetch={false}
                      className={menuItemClasses}
                      onClick={() => setShowMenu(false)}
                    >
                      <Archive className="h-4 w-4 text-[var(--color-text-muted)]" />
                      Your poems
                    </Link>
                    <button
                      type="button"
                      className={menuItemClasses}
                      onClick={() => {
                        setShowHelp(true);
                        setShowMenu(false);
                      }}
                    >
                      <HelpCircle className="h-4 w-4 text-[var(--color-text-muted)]" />
                      How to play
                    </button>
                    <button
                      type="button"
                      className={menuItemClasses}
                      onClick={() => {
                        setShowThemes(true);
                        setShowMenu(false);
                      }}
                    >
                      <Palette className="h-4 w-4 text-[var(--color-text-muted)]" />
                      Theme
                    </button>
                  </div>
                )}

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
