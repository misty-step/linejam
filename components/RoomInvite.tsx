'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Share2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useShareLink } from '@/hooks/useShareLink';
import { trackRoomInviteShared } from '@/lib/analytics';
import { formatRoomCode } from '@/lib/roomCode';
import { playSound } from '@/lib/audio';
import { Alert } from './ui/Alert';
import { Button } from './ui/Button';

export function RoomInvite({ roomCode }: { roomCode: string }) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>(
    'idle'
  );
  const resetCopy = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );
  const formattedCode = formatRoomCode(roomCode);
  const joinUrl =
    globalThis.window === undefined
      ? `/join?code=${roomCode}`
      : `${window.location.origin}/join?code=${roomCode}`;
  const { handleShare, copied, shared, shareError } = useShareLink({
    getShareData: () => ({
      url: joinUrl,
      title: 'Join my Linejam room',
      text: `Join my Linejam room with code ${roomCode}.`,
    }),
    onShared: (method) => trackRoomInviteShared({ method, roomCode }),
    failureMessage: 'Couldn’t share the invite. Try again, or use the QR code.',
  });

  useEffect(() => () => clearTimeout(resetCopy.current), []);

  const copyCode = async () => {
    clearTimeout(resetCopy.current);
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(roomCode);
      setCopyState('copied');
      playSound('success');
      resetCopy.current = setTimeout(() => setCopyState('idle'), 2000);
    } catch {
      setCopyState('error');
      playSound('error');
    }
  };

  return (
    <section
      aria-label="Room invitation"
      className="flex min-w-0 flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface p-3 sm:gap-6 sm:p-5"
    >
      <div className="min-w-0 flex-[1_1_8rem] space-y-3">
        <button
          type="button"
          onClick={() => void copyCode()}
          data-sound="loading"
          aria-label={
            copyState === 'error'
              ? `Retry copying room code ${formattedCode}`
              : `Copy room code ${formattedCode}`
          }
          className="flex min-h-11 w-full min-w-0 items-center gap-2 rounded-lg py-1 text-left text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2"
        >
          <span className="min-w-0 break-words text-3xl font-bold leading-tight tracking-wide sm:text-4xl">
            {formattedCode}
          </span>
          {copyState === 'copied' ? (
            <Check
              className="h-4 w-4 shrink-0 text-success"
              aria-hidden="true"
            />
          ) : (
            <Copy
              className="h-4 w-4 shrink-0 text-text-secondary"
              aria-hidden="true"
            />
          )}
        </button>
        <Button
          type="button"
          onClick={() => void handleShare()}
          data-sound="loading"
          variant="outline"
          className="min-h-11 w-full min-w-0 gap-2 px-3 py-2 text-sm sm:w-auto"
        >
          {shared || copied ? (
            <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <Share2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          <span>
            {shared ? 'Shared' : copied ? 'Link copied' : 'Share invite'}
          </span>
        </Button>
      </div>
      <QRCodeSVG
        value={joinUrl}
        size={144}
        marginSize={4}
        level="M"
        fgColor="#000000"
        bgColor="#ffffff"
        role="img"
        aria-label={`QR code for joining room ${formattedCode}`}
        className="mx-auto h-[112px] w-[112px] shrink-0 rounded-lg sm:h-[144px] sm:w-[144px]"
      />
      <p role="status" aria-live="polite" className="sr-only">
        {copyState === 'copied'
          ? 'Room code copied'
          : shared
            ? 'Invite shared'
            : copied
              ? 'Invite link copied'
              : ''}
      </p>
      {(copyState === 'error' || shareError) && (
        <Alert variant="error" className="basis-full">
          {copyState === 'error'
            ? 'Couldn’t copy the room code. Tap it to retry, or scan the QR code.'
            : shareError}
        </Alert>
      )}
    </section>
  );
}
