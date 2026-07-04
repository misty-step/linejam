'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useMutation, useQuery } from 'convex/react';
import { Crown, Heart, Share2, Volume2, VolumeX } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { trackRoomInviteShared } from '@/lib/analytics';
import { useShareLink } from '@/hooks/useShareLink';
import { useCeremonyEffects } from '@/hooks/useCeremonyEffects';
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
  error,
  isStartingNextRound = false,
  onStartNextRound,
  onBackToLobby,
}: SessionRecapHubProps) {
  const sortedPoems = [...poems].sort((a, b) => a.indexInRoom - b.indexInRoom);
  const lastCrownedPoemId = useRef<Id<'poems'> | null>(null);
  const { isMuted, punctuate, toggleMuted } = useCeremonyEffects();

  // Live tally — the crown can still change as late hearts land.
  const sessionFavorites = useQuery(api.favorites.getSessionFavorites, {
    roomCode,
    guestToken: guestToken || undefined,
  });
  const favoritePoem =
    sessionFavorites?.leaderPoemId != null
      ? sortedPoems.find((p) => p._id === sessionFavorites.leaderPoemId)
      : undefined;
  const enablePublicSessionRecapShare = useMutation(
    api.shares.enablePublicSessionRecapShare
  );
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
      text: `Share the whole set from Linejam room ${roomCode}.`,
    }),
    onShared: (method) => {
      trackRoomInviteShared({ method, roomCode });
    },
    failureMessage: 'Failed to share recap. Please try again.',
  });

  useEffect(() => {
    if (!favoritePoem || sessionFavorites?.leaderCount === 0) return;
    if (lastCrownedPoemId.current === favoritePoem._id) return;

    lastCrownedPoemId.current = favoritePoem._id;
    punctuate('crown');
  }, [favoritePoem, punctuate, sessionFavorites?.leaderCount]);

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

      {(error || shareError) && (
        <Alert variant="error">{error || shareError}</Alert>
      )}

      {/* Room favorite — only crowned when the room actually gave hearts */}
      {favoritePoem && sessionFavorites && (
        <div className="relative overflow-hidden border border-primary bg-surface p-5 shadow-sm">
          <div
            aria-hidden="true"
            className="animate-heart-burst absolute right-5 top-5 h-16 w-16 rounded-full bg-primary/20"
          />
          <div className="relative flex items-center gap-2 text-primary">
            <Heart className="h-4 w-4" fill="currentColor" />
            <Crown
              data-testid="room-favorite-crown"
              className="animate-crown-settle h-5 w-5"
              aria-hidden="true"
            />
            <p className="text-[10px] font-mono uppercase tracking-widest">
              Room favorite · {sessionFavorites.leaderCount} heart
              {sessionFavorites.leaderCount === 1 ? '' : 's'}
            </p>
          </div>
          <Link
            href={`/poem/${favoritePoem._id}`}
            prefetch={false}
            className="mt-2 block font-[var(--font-display)] text-2xl italic leading-relaxed text-text-primary hover:text-primary"
          >
            &ldquo;{favoritePoem.preview || 'Untitled poem'}...&rdquo;
          </Link>
          <p className="mt-1 text-xs font-mono uppercase tracking-widest text-text-muted">
            Read by {favoritePoem.readerName}
          </p>
        </div>
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

      <div className="grid gap-3">
        <Button type="button" onClick={handleShare} size="lg" className="h-14">
          <Share2 className="mr-2 h-4 w-4" />
          {shared ? 'Shared!' : copied ? 'Copied!' : 'Share the whole set'}
        </Button>
      </div>

      <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-between sm:text-left">
        <p className="text-sm text-text-muted">
          Sharing makes the full session recap public to anyone with the link.
        </p>
        <button
          type="button"
          onClick={toggleMuted}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-border-subtle px-3 text-xs font-mono uppercase tracking-wider text-text-muted transition-colors hover:border-primary hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          aria-label={
            isMuted ? 'Turn ceremony sound on' : 'Mute ceremony sound'
          }
        >
          {isMuted ? (
            <VolumeX className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Volume2 className="h-4 w-4" aria-hidden="true" />
          )}
          <span>{isMuted ? 'Muted' : 'Sound'}</span>
        </button>
      </div>

      {/* Anyone in the room can keep it moving — a vanished host never strands the recap. */}
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

      <Link
        href="/"
        className="block text-center text-sm font-mono uppercase tracking-widest text-text-muted hover:underline"
      >
        Exit Room
      </Link>
    </section>
  );
}
