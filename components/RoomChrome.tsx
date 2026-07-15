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
  compact?: boolean;
}

function chromeButtonClasses({
  emphasized = false,
  iconOnly = false,
  compact = false,
}: {
  emphasized?: boolean;
  iconOnly?: boolean;
  compact?: boolean;
} = {}) {
  return cn(
    'inline-flex items-center justify-center rounded-full border',
    compact ? 'h-[44px]' : 'h-11',
    'transition-all duration-[var(--duration-normal)]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2',
    iconOnly ? (compact ? 'w-[44px]' : 'w-11') : compact ? 'px-[16px]' : 'px-4',
    emphasized
      ? 'border-primary bg-primary text-text-inverse hover:bg-primary-hover'
      : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]'
  );
}

const menuItemClasses =
  'flex w-full items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2 text-left text-sm text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-background)] focus-visible:outline-none focus-visible:bg-[var(--color-background)]';

export function RoomChrome({
  roomCode,
  title,
  subtitle,
  compact = false,
}: RoomChromeProps) {
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

      <div
        className={cn(
          'lj-safe-inline sticky top-0 z-40 flex-none',
          compact
            ? '[--lj-safe-inline-space:12px] pt-[max(8px,env(safe-area-inset-top))]'
            : '[--lj-safe-inline-space:0.75rem] pt-[max(0.75rem,env(safe-area-inset-top))] md:[--lj-safe-inline-space:1.5rem]'
        )}
      >
        <div
          className={cn(
            'mx-auto flex w-full max-w-7xl flex-col',
            compact ? 'gap-[8px]' : 'gap-3'
          )}
        >
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
            className={cn(
              'grid rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)]/92 shadow-[var(--shadow-lg)] backdrop-blur-xl',
              compact
                ? 'grid-cols-[minmax(0,1fr)_auto] items-center gap-[8px] px-[12px] py-[8px]'
                : 'gap-2 px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:px-5'
            )}
          >
            <div className={cn('min-w-0', compact ? 'space-y-0' : 'space-y-1')}>
              <div className="flex min-w-0 items-center gap-2">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setShowQr((current) => !current);
                      setShowThemes(false);
                      setShowMenu(false);
                    }}
                    className={cn(
                      'rounded-full border border-[var(--color-border)] bg-[var(--color-background)]/72 text-[0.6875rem] font-mono uppercase tracking-[0.28em] text-[var(--color-text-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors cursor-pointer',
                      compact
                        ? 'max-w-full truncate px-[10px] py-[2px]'
                        : 'shrink-0 px-2.5 py-0.5'
                    )}
                    aria-label={`Room code ${formatRoomCode(roomCode)} — tap to copy or scan QR`}
                  >
                    Room {formatRoomCode(roomCode)}
                  </button>

                  {showQr && (
                    <div className="lj-room-popover absolute left-0 top-full z-50 mt-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-lg)]">
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
                <p className="max-w-3xl whitespace-normal break-words text-xs leading-tight text-[var(--color-text-secondary)] md:text-sm md:leading-relaxed">
                  {subtitle}
                </p>
              )}
            </div>

            <div
              ref={menuRef}
              className={cn(
                'flex min-w-0 items-center md:justify-end',
                compact ? 'flex-none gap-[8px]' : 'gap-2'
              )}
            >
              <button
                type="button"
                onClick={handleShare}
                className={cn(
                  chromeButtonClasses({
                    emphasized: true,
                    iconOnly: compact,
                    compact,
                  }),
                  compact ? 'flex-none p-0' : 'min-w-0 flex-1 md:flex-none'
                )}
                aria-label="Share room invite"
              >
                <Share2
                  className={cn(compact ? 'h-[16px] w-[16px]' : 'mr-2 h-4 w-4')}
                />
                <span className={compact ? 'sr-only' : 'truncate'}>
                  {shared ? 'Shared!' : copied ? 'Copied!' : 'Invite'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setShowHelp(true)}
                className={cn(
                  chromeButtonClasses({ iconOnly: true, compact }),
                  'hidden md:inline-flex'
                )}
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
                  className={chromeButtonClasses({ iconOnly: true, compact })}
                  aria-label="More options"
                  aria-haspopup="true"
                  aria-expanded={showMenu}
                >
                  <MoreHorizontal
                    className={compact ? 'h-[16px] w-[16px]' : 'h-4 w-4'}
                  />
                </button>

                {showMenu && (
                  <div className="lj-room-popover absolute right-0 top-full z-50 mt-3 w-56 max-w-[calc(100vw-2rem)] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5 shadow-[var(--shadow-lg)]">
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
                  <div className="lj-room-popover absolute right-0 top-full z-50 mt-3 w-[320px] max-w-[calc(100vw-2rem)] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-lg)]">
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
