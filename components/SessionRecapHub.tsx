'use client';

import { MouseEvent, useState } from 'react';
import Link from 'next/link';
import { useMutation } from 'convex/react';
import { Share2 } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { trackRoomInviteShared } from '@/lib/analytics';
import { useShareLink } from '@/hooks/useShareLink';
import { Alert } from './ui/Alert';
import { Button } from './ui/Button';
import { Label } from './ui/Label';

export interface SessionRecapPoem {
  _id: Id<'poems'>;
  indexInRoom: number;
  preview: string;
  readerName: string;
}

interface SessionRecapHubProps {
  roomCode: string;
  guestToken?: string;
  poems: SessionRecapPoem[];
  playerCount: number;
  isHost: boolean;
  error?: string | null;
  isStartingNextRound?: boolean;
  onStartNextRound: () => void;
  onBackToLobby: () => void;
}

function sessionRecapUrl(roomCode: string) {
  if (typeof window === 'undefined') return `/recap/${roomCode}`;
  return `${window.location.origin}/recap/${roomCode}`;
}

export function SessionRecapHub({
  roomCode,
  guestToken,
  poems,
  playerCount,
  isHost,
  error,
  isStartingNextRound = false,
  onStartNextRound,
  onBackToLobby,
}: SessionRecapHubProps) {
  const sortedPoems = [...poems].sort((a, b) => a.indexInRoom - b.indexInRoom);
  const [openError, setOpenError] = useState<string | null>(null);
  const enablePublicSessionRecapShare = useMutation(
    api.shares.enablePublicSessionRecapShare
  );
  const recapHref = `/recap/${roomCode}`;
  const enablePublicRecap = async () => {
    await enablePublicSessionRecapShare({
      roomCode,
      guestToken: guestToken || undefined,
    });
  };
  const { handleShare, copied, shared, shareError } = useShareLink({
    beforeShare: enablePublicRecap,
    getShareData: () => ({
      url: sessionRecapUrl(roomCode),
      title: 'Linejam session recap',
      text: `Replay every poem from our Linejam session in room ${roomCode}.`,
    }),
    onShared: (method) => {
      trackRoomInviteShared({ method, roomCode });
    },
    failureMessage: 'Failed to share recap. Please try again.',
  });

  const handleOpenSharedRecap = async (
    event: MouseEvent<HTMLAnchorElement>
  ) => {
    event.preventDefault();
    setOpenError(null);

    try {
      await enablePublicRecap();
      window.location.assign(recapHref);
    } catch {
      setOpenError('Failed to publish recap. Please try again.');
    }
  };

  return (
    <section
      aria-labelledby="session-recap-title"
      className="space-y-8 pt-8 border-t border-border"
    >
      <div className="space-y-4">
        <Label className="block">Session Recap</Label>
        <div className="space-y-3">
          <h2
            id="session-recap-title"
            className="text-4xl md:text-5xl font-[var(--font-display)] leading-tight"
          >
            Session complete
          </h2>
          <p className="text-text-secondary leading-relaxed">
            Replay the full set, share the group recap, or keep this room moving
            into another round.
          </p>
          <div className="flex flex-wrap gap-2 text-xs font-mono uppercase tracking-widest text-text-muted">
            <span>{sortedPoems.length} poems</span>
            <span aria-hidden="true">/</span>
            <span>
              {playerCount} poet{playerCount === 1 ? '' : 's'}
            </span>
          </div>
        </div>
      </div>

      {(error || shareError || openError) && (
        <Alert variant="error">{error || shareError || openError}</Alert>
      )}

      <div className="grid gap-3">
        {sortedPoems.map((poem) => {
          const poemNumber = poem.indexInRoom + 1;
          const preview = poem.preview || 'Untitled poem';

          return (
            <Link
              key={poem._id}
              href={`/poem/${poem._id}`}
              prefetch={false}
              aria-label={`Replay poem ${poemNumber}: ${preview}`}
              className="group block border border-border-subtle bg-surface p-5 transition-colors hover:border-primary"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-2">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-text-muted">
                    Poem {poemNumber.toString().padStart(2, '0')} / read by{' '}
                    {poem.readerName}
                  </p>
                  <p className="font-[var(--font-display)] text-xl italic leading-relaxed">
                    &ldquo;{preview}...&rdquo;
                  </p>
                </div>
                <span className="shrink-0 text-[10px] font-mono uppercase tracking-widest text-text-muted group-hover:text-primary">
                  Replay
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Button type="button" onClick={handleShare} size="lg" className="h-14">
          <Share2 className="mr-2 h-4 w-4" />
          {shared ? 'Shared!' : copied ? 'Copied!' : 'Share Session'}
        </Button>

        <Link
          href={recapHref}
          prefetch={false}
          onClick={handleOpenSharedRecap}
          className="inline-flex h-14 w-full items-center justify-center rounded-md border border-border bg-surface px-8 text-lg font-medium text-text-primary shadow-sm transition-all duration-[var(--duration-normal)] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 active:scale-[0.96]"
        >
          Open Shared Recap
        </Link>
      </div>

      <p className="text-sm text-text-muted text-center">
        Sharing makes the full session recap public to anyone with the link.
      </p>

      {isHost ? (
        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={onStartNextRound}
            size="lg"
            className="h-14"
            disabled={isStartingNextRound}
          >
            {isStartingNextRound ? 'Starting...' : 'Start Next Round'}
          </Button>
          <Button
            onClick={onBackToLobby}
            variant="outline"
            size="lg"
            className="h-14"
          >
            Back to Lobby
          </Button>
        </div>
      ) : (
        <p className="text-sm text-text-muted text-center">
          You can replay and share the session while the host starts the next
          round.
        </p>
      )}

      <Link
        href="/"
        className="block text-center text-sm font-mono uppercase tracking-widest text-text-muted hover:underline"
      >
        Exit Room
      </Link>
    </section>
  );
}
