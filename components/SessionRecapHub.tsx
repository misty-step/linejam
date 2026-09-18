'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery } from 'convex/react';
import { Crown, Share2 } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import {
  hashRoomId,
  trackArtifactAction,
  trackRoomInviteShared,
} from '@/lib/analytics';
import { E2E_TEST_IDS } from '@/lib/e2eTestIds';
import { useShareLink, type ShareLinkClient } from '@/hooks/useShareLink';
import { useCeremonyEffects } from '@/hooks/useCeremonyEffects';
import { SoundControl } from './SoundControl';
import { playSound } from '@/lib/audio';
import { Alert } from './ui/Alert';
import { Button } from './ui/Button';
import { Avatar } from './ui/Avatar';
import type { AvatarId } from '@/lib/avatars';
import { errorToFeedback } from '@/lib/errorFeedback';
import { toErrorReportable } from '@/lib/errorCore';

export interface SessionRecapPoem {
  _id: Id<'poems'>;
  indexInRoom: number;
  preview: string;
  readerName: string;
  readerStableId?: string;
  readerAvatarId?: AvatarId;
}
interface SessionRecapShareAccess {
  roomCode: string;
  guestToken?: string;
}
interface SessionFavorites {
  leaderPoemId: Id<'poems'> | null;
  leaderCount: number;
}

export interface SessionRecapHubDependencies {
  useEnablePublicShare: () => (args: SessionRecapShareAccess) => Promise<null>;
  useDisablePublicShare: () => (args: SessionRecapShareAccess) => Promise<null>;
  useSessionFavorites: (
    args: SessionRecapShareAccess
  ) => SessionFavorites | null | undefined;
  shareClient?: ShareLinkClient;
  trackRoomInviteShared: (properties: {
    method: 'clipboard' | 'native-share';
    roomCode: string;
  }) => void;
  trackArtifactAction: (properties: {
    roomIdHash: string;
    cycle: number;
    round: number;
    action: 'share';
  }) => void;
  hashRoomId: (roomId: string) => string;
  getRecapUrl: (roomCode: string) => string;
}

function useDefaultEnablePublicShare() {
  return useMutation(api.shares.enablePublicSessionRecapShare);
}

function useDefaultDisablePublicShare() {
  return useMutation(api.shares.disablePublicSessionRecapShare);
}

function useDefaultSessionFavorites(args: SessionRecapShareAccess) {
  return useQuery(api.favorites.getSessionFavorites, args);
}

function sessionRecapUrl(roomCode: string) {
  if (globalThis.window === undefined) return `/recap/${roomCode}`;
  return `${globalThis.window.location.origin}/recap/${roomCode}`;
}

const defaultDependencies: SessionRecapHubDependencies = {
  useEnablePublicShare: useDefaultEnablePublicShare,
  useDisablePublicShare: useDefaultDisablePublicShare,
  useSessionFavorites: useDefaultSessionFavorites,
  trackRoomInviteShared,
  trackArtifactAction,
  hashRoomId,
  getRecapUrl: sessionRecapUrl,
};

interface SessionRecapHubProps {
  roomCode: string;
  roomId?: string;
  cycle?: number;
  guestToken?: string;
  poems: SessionRecapPoem[];
  playerCount: number;
  canShare: boolean;
  onReplayPoem?: (poemId: Id<'poems'>) => void;
  error?: string | null;
  isStartingNextRound?: boolean;
  onStartNextRound?: () => void;
  onBackToLobby?: () => void;
  dependencies?: SessionRecapHubDependencies;
}

export function SessionRecapHub({
  roomCode,
  roomId,
  cycle,
  guestToken,
  poems,
  playerCount,
  canShare,
  onReplayPoem,
  error,
  isStartingNextRound = false,
  onStartNextRound,
  onBackToLobby,
  dependencies,
}: SessionRecapHubProps) {
  const sortedPoems = [...poems].sort((a, b) => a.indexInRoom - b.indexInRoom);
  const lastCrownedPoemId = useRef<Id<'poems'> | null>(null);
  const { punctuate } = useCeremonyEffects();
  const [isSharing, setIsSharing] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [revoked, setRevoked] = useState(false);

  const resolvedDependencies = dependencies ?? defaultDependencies;
  // Live tally — the crown can still change as late hearts land.
  const sessionFavorites = resolvedDependencies.useSessionFavorites({
    roomCode,
    guestToken: guestToken || undefined,
  });
  const favoritePoem =
    sessionFavorites?.leaderPoemId != null
      ? sortedPoems.find((p) => p._id === sessionFavorites.leaderPoemId)
      : undefined;
  const enablePublicSessionRecapShare =
    resolvedDependencies.useEnablePublicShare();
  const disablePublicSessionRecapShare =
    resolvedDependencies.useDisablePublicShare();
  const enablePublicRecap = async () => {
    await enablePublicSessionRecapShare({
      roomCode,
      guestToken: guestToken || undefined,
    });
  };
  const { handleShare, copied, shared, shareError } = useShareLink({
    publishShare: enablePublicRecap,
    getShareData: () => ({
      url: resolvedDependencies.getRecapUrl(roomCode),
      title: 'Linejam session recap',
      text: `Share the whole set from Linejam room ${roomCode}.`,
    }),
    onShared: (method) => {
      resolvedDependencies.trackRoomInviteShared({ method, roomCode });
      resolvedDependencies.trackArtifactAction({
        roomIdHash: resolvedDependencies.hashRoomId(roomId ?? roomCode),
        cycle: cycle ?? 1,
        round: poems.length > 0 ? 8 : 0,
        action: 'share',
      });
    },
    failureMessage: 'Failed to share recap. Please try again.',
    client: resolvedDependencies.shareClient,
  });

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
      await disablePublicSessionRecapShare({
        roomCode,
        guestToken: guestToken || undefined,
      });
      setRevoked(true);
      playSound('success');
    } catch (cause) {
      playSound('error');
      setRevokeError(errorToFeedback(toErrorReportable(cause)).message);
    } finally {
      setIsRevoking(false);
    }
  };

  useEffect(() => {
    if (!favoritePoem || sessionFavorites?.leaderCount === 0) return;
    if (lastCrownedPoemId.current === favoritePoem._id) return;

    lastCrownedPoemId.current = favoritePoem._id;
    punctuate();
  }, [favoritePoem, punctuate, sessionFavorites?.leaderCount]);

  return (
    <section
      data-testid={E2E_TEST_IDS.sessionComplete}
      aria-labelledby="session-recap-title"
      className="space-y-6 font-sans"
    >
      <header className="space-y-2">
        <h2
          id="session-recap-title"
          tabIndex={-1}
          className="scroll-mt-28 text-2xl font-bold leading-snug text-text-primary focus:outline-none"
        >
          Session complete
        </h2>
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-secondary">
          <span>{sortedPoems.length} poems</span>
          <span>
            {playerCount} poet{playerCount === 1 ? '' : 's'}
          </span>
        </p>
      </header>

      {(error || shareError || revokeError) && (
        <Alert variant="error">{error || revokeError || shareError}</Alert>
      )}

      {favoritePoem && sessionFavorites && (
        <section
          aria-labelledby="room-favorite-title"
          className="space-y-2 rounded-2xl border border-primary bg-surface p-5"
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-primary">
            <h3
              id="room-favorite-title"
              className="inline-flex items-center gap-2 text-sm font-bold"
            >
              <Crown
                data-testid={E2E_TEST_IDS.roomFavoriteCrown}
                className="h-5 w-5"
                aria-hidden="true"
              />
              Room favorite
            </h3>
            <span className="text-sm">
              {sessionFavorites.leaderCount} heart
              {sessionFavorites.leaderCount === 1 ? '' : 's'}
            </span>
          </div>
          <Link
            href={`/poem/${favoritePoem._id}`}
            prefetch={false}
            data-prefetch="false"
            className="block min-h-11 py-2 text-xl font-semibold leading-snug text-text-primary [overflow-wrap:anywhere] hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus-ring"
          >
            {favoritePoem.preview || 'Untitled poem'}…
          </Link>
          <p className="text-sm text-text-secondary [overflow-wrap:anywhere]">
            Read by {favoritePoem.readerName}
          </p>
        </section>
      )}

      <ol
        aria-label="Session poems"
        className="overflow-hidden rounded-3xl bg-surface"
      >
        {sortedPoems.map((poem) => {
          const poemNumber = poem.indexInRoom + 1;
          const preview = poem.preview || 'Untitled poem';

          const content = (
            <>
              {poem.readerStableId && (
                <Avatar
                  stableId={poem.readerStableId}
                  displayName={poem.readerName}
                  avatarId={poem.readerAvatarId}
                  size="sm"
                />
              )}
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm text-text-secondary [overflow-wrap:anywhere]">
                  Poem {poemNumber}, read by {poem.readerName}
                </p>
                <p className="text-lg font-semibold leading-snug text-text-primary [overflow-wrap:anywhere]">
                  {preview}…
                </p>
              </div>
            </>
          );

          return (
            <li
              key={poem._id}
              className="border-b border-border-subtle last:border-b-0"
            >
              {onReplayPoem ? (
                <button
                  type="button"
                  onClick={() => onReplayPoem(poem._id)}
                  data-sound="bloom"
                  aria-label={`Replay poem ${poemNumber}: ${preview}`}
                  className="flex min-h-11 w-full items-start gap-3 p-5 text-left hover:bg-primary/5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus-ring"
                >
                  {content}
                </button>
              ) : (
                <Link
                  href={`/poem/${poem._id}`}
                  prefetch={false}
                  data-prefetch="false"
                  aria-label={`Replay poem ${poemNumber}: ${preview}`}
                  className="flex min-h-11 items-start gap-3 p-5 hover:bg-primary/5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus-ring"
                >
                  {content}
                </Link>
              )}
            </li>
          );
        })}
      </ol>

      {canShare && (
        <div className="space-y-3">
          <p
            id="recap-share-disclosure"
            className="text-sm text-text-secondary"
          >
            Sharing makes the full session recap public to anyone with the link.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={handlePublish}
              data-sound="loading"
              data-testid={E2E_TEST_IDS.sessionRecapShareButton}
              aria-describedby="recap-share-disclosure"
              variant="outline"
              className="min-h-11"
              disabled={isSharing || isRevoking}
            >
              <Share2 className="mr-2 h-4 w-4" aria-hidden="true" />
              {isSharing ? 'Sharing...' : 'Share recap'}
            </Button>
            <Button
              onClick={handleRevoke}
              data-sound="loading"
              variant="ghost"
              className="min-h-11"
              disabled={isSharing || isRevoking}
            >
              {isRevoking ? 'Revoking...' : 'Revoke public link'}
            </Button>
          </div>
          {(revoked || shared || copied) && (
            <p role="status" className="text-sm text-primary">
              {revoked
                ? 'Public recap link revoked.'
                : shared
                  ? 'Recap shared.'
                  : 'Recap link copied.'}
            </p>
          )}
        </div>
      )}

      {onStartNextRound || onBackToLobby ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {onStartNextRound && (
            <Button
              onClick={onStartNextRound}
              data-sound="loading"
              size="lg"
              className="min-h-12"
              disabled={isStartingNextRound}
            >
              {isStartingNextRound ? 'Starting...' : 'Play again'}
            </Button>
          )}
          {onBackToLobby && (
            <Button
              onClick={onBackToLobby}
              data-sound="loading"
              variant="outline"
              size="lg"
              className="min-h-12"
            >
              Back to lobby
            </Button>
          )}
        </div>
      ) : (
        <p className="text-sm text-text-secondary">
          Start a new room from home to play again.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center text-sm font-semibold text-text-secondary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus-ring"
        >
          Exit room
        </Link>
        <SoundControl showLabel />
      </div>
    </section>
  );
}
