'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  Archive,
  Check,
  HelpCircle,
  MoreHorizontal,
  Share2,
  X,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { HelpModal } from './HelpModal';
import { ColorModeControl } from './ColorModeControl';
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
  statusBoard?: boolean;
}

function chromeButtonClasses({
  emphasized = false,
  iconOnly = false,
}: {
  emphasized?: boolean;
  iconOnly?: boolean;
} = {}) {
  return cn(
    'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border text-base font-semibold transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2',
    iconOnly ? 'w-[44px] shrink-0' : 'min-w-0 px-4 py-2',
    emphasized
      ? 'border-primary bg-primary text-text-inverse hover:bg-primary-hover'
      : 'border-border bg-surface text-text-primary hover:border-primary hover:text-primary'
  );
}

const menuItemClasses =
  'flex min-h-[44px] w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-3 text-left text-base font-semibold text-text-primary transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring';

export function RoomChrome({
  roomCode,
  title,
  subtitle,
  compact = false,
  statusBoard = false,
}: RoomChromeProps) {
  const [showHelp, setShowHelp] = useState(false);
  const [panel, setPanel] = useState<'invite' | 'options' | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [codeCopyError, setCodeCopyError] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLButtonElement>(null);
  const copyTimeoutRef = useRef<number | undefined>(undefined);
  const panelOpen = panel !== null;
  const { handleShare, copied, shared, shareError } = useShareLink({
    getShareData: () => ({
      url: `${window.location.origin}/join?code=${roomCode}`,
      title: 'Join my Linejam room',
      text: `Join my Linejam room with code ${roomCode}.`,
    }),
    onShared: (method) => {
      trackRoomInviteShared({ method, roomCode });
    },
    failureMessage: 'Couldn’t share the invite. Try again.',
  });

  const joinUrl =
    globalThis.window === undefined
      ? `/join?code=${roomCode}`
      : `${globalThis.window.location.origin}/join?code=${roomCode}`;
  const formattedCode = formatRoomCode(roomCode);

  const handleCopyCode = async () => {
    setCodeCopyError(false);
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(roomCode);
      setCodeCopied(true);
      window.clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = window.setTimeout(
        () => setCodeCopied(false),
        2000
      );
    } catch {
      setCodeCopied(false);
      setCodeCopyError(true);
    }
  };

  useEffect(
    () => () => {
      window.clearTimeout(copyTimeoutRef.current);
    },
    []
  );

  useEffect(() => {
    if (!panelOpen) return;

    const returnFocus = returnFocusRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setPanel(null);
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not(:disabled), [href], input:not(:disabled):not([type="radio"]), input[type="radio"]:checked, select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (
        (!event.shiftKey && document.activeElement === last) ||
        !dialogRef.current.contains(document.activeElement)
      ) {
        event.preventDefault();
        first?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      if (returnFocus?.isConnected) returnFocus.focus();
    };
  }, [panelOpen]);

  useEffect(() => {
    if (panel) closeButtonRef.current?.focus();
  }, [panel]);

  return (
    <>
      <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />

      <div
        className={cn(
          'lj-safe-inline relative z-40 flex-none bg-background',
          compact
            ? '[--lj-safe-inline-space:12px] pt-[max(4px,env(safe-area-inset-top))]'
            : '[--lj-safe-inline-space:1rem] pt-[max(0.5rem,env(safe-area-inset-top))] md:[--lj-safe-inline-space:1.5rem]'
        )}
      >
        <div className="mx-auto w-full max-w-5xl">
          <div
            data-testid="room-chrome"
            data-layout={statusBoard ? 'status-board' : undefined}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 py-2"
          >
            <button
              type="button"
              onClick={(event) => {
                returnFocusRef.current = event.currentTarget;
                setPanel('invite');
              }}
              className="min-h-[44px] min-w-0 justify-self-start rounded-[var(--radius-md)] px-2 py-2 text-left text-base leading-tight text-text-secondary transition-colors hover:bg-surface hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              aria-label={`Open QR and copy options for room code ${formattedCode}`}
              aria-haspopup="dialog"
              aria-expanded={panel === 'invite'}
              aria-controls={panel === 'invite' ? 'room-invite' : undefined}
            >
              {compact ? (
                <strong className="font-bold text-text-primary">
                  {formattedCode}
                </strong>
              ) : (
                <>
                  Room{' '}
                  <strong className="font-bold text-text-primary">
                    {formattedCode}
                  </strong>
                </>
              )}
            </button>

            <div className="flex shrink-0 items-center gap-2">
              {!compact && (
                <button
                  type="button"
                  onClick={handleShare}
                  className={chromeButtonClasses({
                    emphasized: true,
                    iconOnly: true,
                  })}
                  aria-label="Share room invite"
                >
                  {shared || copied ? (
                    <Check className="h-[20px] w-[20px]" aria-hidden="true" />
                  ) : (
                    <Share2 className="h-[20px] w-[20px]" aria-hidden="true" />
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowHelp(true)}
                className={chromeButtonClasses({ iconOnly: true })}
                aria-label="How to play"
              >
                <HelpCircle className="h-[20px] w-[20px]" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={(event) => {
                  returnFocusRef.current = event.currentTarget;
                  setPanel('options');
                }}
                className={chromeButtonClasses({ iconOnly: true })}
                aria-label="More options"
                aria-haspopup="dialog"
                aria-expanded={panel === 'options'}
                aria-controls={panel === 'options' ? 'room-options' : undefined}
              >
                <MoreHorizontal
                  className="h-[20px] w-[20px]"
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>

          <div className={compact || statusBoard ? 'sr-only' : 'pb-3'}>
            {statusBoard ? (
              <p role="status" aria-live="polite">
                {title}
                {subtitle ? `. ${subtitle}` : ''}
              </p>
            ) : (
              <>
                <h1 className="break-words text-xl font-bold text-text-primary">
                  {title}
                </h1>
                {subtitle && (
                  <p className="mt-1 break-words text-base text-text-secondary">
                    {subtitle}
                  </p>
                )}
              </>
            )}
          </div>
          <p role="status" aria-live="polite" className="sr-only">
            {shared ? 'Invite shared' : copied ? 'Invite link copied' : ''}
          </p>
          {shareError && !panel && (
            <Alert variant="error" className="mb-2">
              {shareError}
            </Alert>
          )}
        </div>
      </div>

      {panel && (
        <div
          className="lj-game-frame lj-viewport-offset lj-safe-frame fixed inset-0 z-50 flex items-center justify-center bg-text-primary/40"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setPanel(null);
          }}
        >
          <div
            ref={dialogRef}
            id={panel === 'invite' ? 'room-invite' : 'room-options'}
            role="dialog"
            aria-modal="true"
            aria-labelledby="room-panel-title"
            className="flex max-h-full w-full min-w-0 max-w-md flex-col overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface text-text-primary shadow-[var(--shadow-lg)]"
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
              <h2
                id="room-panel-title"
                className="min-w-0 break-words text-lg font-bold"
              >
                {panel === 'invite' ? 'Invite friends' : 'Room options'}
              </h2>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => setPanel(null)}
                className={chromeButtonClasses({ iconOnly: true })}
                aria-label={
                  panel === 'invite' ? 'Close invite' : 'Close options'
                }
              >
                <X className="h-[20px] w-[20px]" aria-hidden="true" />
              </button>
            </div>
            <div className="min-h-0 overflow-y-auto overscroll-contain p-4">
              {panel === 'invite' ? (
                <div className="space-y-4">
                  <p className="text-center text-base text-text-secondary">
                    Room code{' '}
                    <strong className="block text-3xl font-bold tracking-wide text-text-primary">
                      {formattedCode}
                    </strong>
                  </p>
                  <QRCodeSVG
                    value={joinUrl}
                    size={192}
                    level="M"
                    fgColor="var(--color-text-primary)"
                    bgColor="var(--color-surface)"
                    role="img"
                    aria-label={`QR code for joining room ${formattedCode}`}
                    className="mx-auto block h-auto w-full max-w-48"
                  />
                  {codeCopyError && (
                    <Alert variant="error">
                      Couldn&apos;t copy the room code. Try again.
                    </Alert>
                  )}
                  {shareError && <Alert variant="error">{shareError}</Alert>}
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => void handleCopyCode()}
                      className={chromeButtonClasses()}
                      aria-label={
                        codeCopyError
                          ? 'Retry copying room code'
                          : codeCopied
                            ? 'Room code copied'
                            : 'Copy room code'
                      }
                    >
                      {codeCopied ? 'Copied' : 'Copy code'}
                    </button>
                    <button
                      type="button"
                      onClick={handleShare}
                      className={chromeButtonClasses({ emphasized: true })}
                      aria-label="Share room invite"
                    >
                      <Share2
                        className="h-[20px] w-[20px] shrink-0"
                        aria-hidden="true"
                      />
                      {shared ? 'Shared' : copied ? 'Copied' : 'Share invite'}
                    </button>
                  </div>
                  <a
                    href={joinUrl}
                    className="flex min-h-[44px] items-center justify-center text-center text-base font-semibold text-primary underline underline-offset-4"
                  >
                    Open join link
                  </a>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    className={menuItemClasses}
                    onClick={() => setPanel('invite')}
                  >
                    <Share2 className="h-5 w-5 shrink-0" aria-hidden="true" />
                    Invite friends
                  </button>
                  <Link
                    href="/me/poems"
                    prefetch={false}
                    className={menuItemClasses}
                    onClick={() => setPanel(null)}
                  >
                    <Archive className="h-5 w-5 shrink-0" aria-hidden="true" />
                    Your poems
                  </Link>
                  <ColorModeControl className="mt-4" />
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
