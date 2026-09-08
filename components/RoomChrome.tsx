'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { Archive, HelpCircle, LogOut, MoreHorizontal, X } from 'lucide-react';
import { Brand } from './Brand';
import { ColorModeControl } from './ColorModeControl';
import { HelpContent } from './HelpModal';
import { RoomInvite } from './RoomInvite';
import { Alert } from './ui/Alert';
import { Button } from './ui/Button';
import { captureError } from '@/lib/error';
import { errorToFeedback } from '@/lib/errorFeedback';
import { toErrorReportable } from '@/lib/errorCore';
import { formatRoomCode } from '@/lib/roomCode';

export interface RoomAction {
  kind: 'end-game' | 'close-room' | 'leave-room';
  run(): Promise<void>;
}

interface RoomChromeProps {
  roomCode: string;
  isLobby: boolean;
  action?: RoomAction;
}

const actionCopy = {
  'end-game': {
    label: 'End game',
    title: 'End this game?',
    detail: 'Everyone returns to the lobby. Partial poems stay private.',
    cancel: 'Keep playing',
    pending: 'Ending game…',
  },
  'close-room': {
    label: 'Close room',
    title: 'Close this room?',
    detail: 'Everyone leaves this room. Saved poems stay in your archive.',
    cancel: 'Keep room open',
    pending: 'Closing room…',
  },
  'leave-room': {
    label: 'Leave room',
    title: 'Leave this room?',
    detail: 'The room stays open for the others. You can rejoin with its code.',
    cancel: 'Stay here',
    pending: 'Leaving room…',
  },
} as const;

const iconButton =
  'inline-flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2';
const menuItem =
  'flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-3 text-left font-semibold hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring';

export function RoomChrome({ roomCode, isLobby, action }: RoomChromeProps) {
  const [panel, setPanel] = useState<
    'invite' | 'options' | 'help' | 'confirm' | null
  >(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const titleId = useId();
  const panelOpen = panel !== null;
  const copy = action ? actionCopy[action.kind] : null;

  const close = () => {
    if (!pendingRef.current) setPanel(null);
  };

  useEffect(() => {
    if (!panelOpen) return;
    const returnFocus = returnFocusRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!pendingRef.current) setPanel(null);
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])'
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

  const confirmAction = async () => {
    if (!action || pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setError(null);
    try {
      await action.run();
      setPanel(null);
    } catch (cause) {
      const reportable = toErrorReportable(cause);
      setError(errorToFeedback(reportable).message);
      captureError(reportable, { roomCode, operation: action.kind });
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };

  const title =
    panel === 'invite'
      ? 'Invite friends'
      : panel === 'help'
        ? 'How to play'
        : panel === 'confirm' && copy
          ? copy.title
          : 'Room options';

  return (
    <>
      <header className="lj-safe-inline shrink-0 bg-background pt-[max(0.25rem,env(safe-area-inset-top))] [--lj-safe-inline-space:1rem]">
        <div
          data-testid="room-chrome"
          className="mx-auto flex w-full max-w-xl items-center justify-between gap-3 py-2"
        >
          {isLobby ? (
            <Brand className="text-[20px]" />
          ) : (
            <button
              type="button"
              onClick={(event) => {
                returnFocusRef.current = event.currentTarget;
                setPanel('invite');
              }}
              aria-label={`Invite friends to room ${formatRoomCode(roomCode)}`}
              aria-haspopup="dialog"
              aria-expanded={panel === 'invite'}
              aria-controls={panel === 'invite' ? panelId : undefined}
              className="min-h-11 min-w-0 rounded-lg py-2 text-left text-lg font-bold tracking-wide text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              {formatRoomCode(roomCode)}
            </button>
          )}
          <div className="flex shrink-0 items-center gap-1">
            <ColorModeControl />
            <button
              type="button"
              onClick={(event) => {
                returnFocusRef.current = event.currentTarget;
                setPanel('options');
              }}
              aria-label="Room options"
              aria-haspopup="dialog"
              aria-expanded={panel !== null && panel !== 'invite'}
              aria-controls={
                panel !== null && panel !== 'invite' ? panelId : undefined
              }
              className={iconButton}
            >
              <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>
      {panel && (
        <div
          className="lj-game-frame lj-viewport-offset lj-safe-frame fixed inset-0 z-50 flex items-center justify-center bg-text-primary/40"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div
            ref={dialogRef}
            id={panelId}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="flex max-h-full w-full min-w-0 max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-lg)]"
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border-subtle px-4 py-2">
              <h2
                id={titleId}
                className="min-w-0 break-words text-xl font-bold text-text-primary"
              >
                {title}
              </h2>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={close}
                disabled={pending}
                aria-label="Close panel"
                className={iconButton}
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            {panel === 'help' ? (
              <HelpContent onClose={close} />
            ) : (
              <div className="min-h-0 overflow-y-auto overscroll-contain p-4">
                {panel === 'invite' ? (
                  <RoomInvite roomCode={roomCode} />
                ) : panel === 'confirm' && action && copy ? (
                  <div className="space-y-5">
                    <p className="leading-relaxed text-text-secondary">
                      {copy.detail}
                    </p>
                    {error && <Alert variant="error">{error}</Alert>}
                    <div className="flex flex-wrap gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={pending}
                        onClick={() => setPanel('options')}
                        className="min-h-11 flex-1"
                      >
                        {copy.cancel}
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        disabled={pending}
                        onClick={() => void confirmAction()}
                        className="min-h-11 flex-1"
                      >
                        {pending ? copy.pending : copy.label}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <button
                      type="button"
                      className={menuItem}
                      onClick={() => setPanel('help')}
                    >
                      <HelpCircle
                        className="h-5 w-5 shrink-0"
                        aria-hidden="true"
                      />
                      How to play
                    </button>
                    <Link
                      href="/me/poems"
                      prefetch={false}
                      className={menuItem}
                      onClick={close}
                    >
                      <Archive
                        className="h-5 w-5 shrink-0"
                        aria-hidden="true"
                      />
                      Your poems
                    </Link>
                    {action && copy && (
                      <div className="mt-3 border-t border-border-subtle pt-3">
                        <button
                          type="button"
                          className={`${menuItem} text-error`}
                          onClick={() => {
                            setError(null);
                            setPanel('confirm');
                          }}
                        >
                          <LogOut
                            className="h-5 w-5 shrink-0"
                            aria-hidden="true"
                          />
                          {copy.label}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
