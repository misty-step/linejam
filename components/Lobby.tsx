'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from 'convex/react';
import type { FunctionArgs, FunctionReturnType } from 'convex/server';
import { api } from '../convex/_generated/api';
import { E2E_TEST_IDS } from '../lib/e2eTestIds';
import { errorToFeedback } from '../lib/errorFeedback';
import { toErrorReportable } from '../lib/errorCore';
import { formatRoomCode } from '../lib/roomCode';
import { Alert } from './ui/Alert';
import { Avatar } from './ui/Avatar';
import { Button } from './ui/Button';
import { HostBadge } from './ui/HostBadge';
import { LobbyJoinQr, LobbyStage } from './stage/LobbyStage';
import { StampAnimation } from './ui/StampAnimation';
import { Doc } from '../convex/_generated/dataModel';
import { Presentation } from 'lucide-react';
import {
  hashRoomId,
  trackGameStarted,
  trackLobbyReady,
} from '../lib/analytics';

/**
 * Lobby layout keeps actions separate from the live player list.
 * Room identity and phase status live in RoomChrome above this component.
 */

interface LobbyPlayer extends Doc<'roomPlayers'> {
  stableId: string;
  isAway?: boolean;
}

type StartGame = (
  args: FunctionArgs<typeof api.game.startGame>
) => Promise<FunctionReturnType<typeof api.game.startGame>>;
type LeaveLobby = (
  args: FunctionArgs<typeof api.rooms.leaveLobby>
) => Promise<FunctionReturnType<typeof api.rooms.leaveLobby>>;
type CloseRoom = (
  args: FunctionArgs<typeof api.rooms.closeRoom>
) => Promise<FunctionReturnType<typeof api.rooms.closeRoom>>;

function useDefaultStartGame(): StartGame {
  return useMutation(api.game.startGame);
}

function useDefaultLeaveLobby(): LeaveLobby {
  return useMutation(api.rooms.leaveLobby);
}

function useDefaultCloseRoom(): CloseRoom {
  return useMutation(api.rooms.closeRoom);
}

export interface LobbyDependencies {
  useRouter: typeof useRouter;
  useStartGame: () => StartGame;
  useLeaveLobby: () => LeaveLobby;
  useCloseRoom: () => CloseRoom;
  hashRoomId: typeof hashRoomId;
  trackGameStarted: typeof trackGameStarted;
  trackLobbyReady: typeof trackLobbyReady;
}

const defaultDependencies: LobbyDependencies = {
  useRouter,
  useStartGame: useDefaultStartGame,
  useLeaveLobby: useDefaultLeaveLobby,
  useCloseRoom: useDefaultCloseRoom,
  hashRoomId,
  trackGameStarted,
  trackLobbyReady,
};

interface LobbyProps {
  room: Doc<'rooms'>;
  players: LobbyPlayer[];
  isHost: boolean;
  guestToken: string | null;
  dependencies?: LobbyDependencies;
}

export function Lobby({
  room,
  players,
  isHost,
  guestToken,
  dependencies = defaultDependencies,
}: LobbyProps) {
  const router = dependencies.useRouter();
  const startGameMutation = dependencies.useStartGame();
  const leaveLobbyMutation = dependencies.useLeaveLobby();
  const closeRoomMutation = dependencies.useCloseRoom();
  const [error, setError] = useState<string | null>(null);
  const [isPresenting, setIsPresenting] = useState(false);

  // For unique avatar colors
  const allStableIds = players.map((p) => p.stableId);

  const handleStartGame = async () => {
    if (!room) return;
    setError(null); // Clear error before retry
    try {
      await startGameMutation({
        code: room.code,
        guestToken: guestToken || undefined,
      });
      // The mutation is authoritative and increments the cycle for rematches.
      // Emit both transition stages only after it succeeds, so retries/failures
      // cannot report a lobby as ready or use the previous cycle number.
      const cycle = (room.currentCycle ?? 0) + 1;
      const analyticsProps = {
        roomIdHash: dependencies.hashRoomId(room._id),
        cycle,
      };
      dependencies.trackLobbyReady(analyticsProps);
      dependencies.trackGameStarted(analyticsProps);
    } catch (cause) {
      const feedback = errorToFeedback(toErrorReportable(cause));
      setError(feedback.message);
    }
  };

  const minPlayers = 2;
  const needsMore = minPlayers - players.length;
  const canStart = players.length >= minPlayers;

  const handleLeaveLobby = async () => {
    setError(null);
    try {
      await leaveLobbyMutation({
        roomCode: room.code,
        guestToken: guestToken || undefined,
      });
      router.push('/');
    } catch (cause) {
      const feedback = errorToFeedback(toErrorReportable(cause));
      setError(feedback.message);
    }
  };

  const handleCloseRoom = async () => {
    setError(null);
    try {
      await closeRoomMutation({
        roomCode: room.code,
        guestToken: guestToken || undefined,
      });
      router.push('/');
    } catch (cause) {
      const feedback = errorToFeedback(toErrorReportable(cause));
      setError(feedback.message);
    }
  };

  // Extract button rendering logic (DRY principle for strategic duplication)
  const renderButton = (className?: string) => {
    if (isHost) {
      return (
        <div className="space-y-3">
          <Button
            onClick={handleStartGame}
            data-testid={E2E_TEST_IDS.lobbyStartGameButton}
            size="lg"
            className={`h-auto min-h-[64px] w-full min-w-0 px-[16px] py-[12px] text-[clamp(1rem,5vw,1.125rem)] md:min-h-16 md:px-8 md:text-lg ${className || ''}`}
            disabled={!canStart}
            variant={canStart ? 'primary' : 'secondary'}
          >
            {canStart
              ? 'Start Linejam'
              : `Need ${needsMore} more player${needsMore === 1 ? '' : 's'}`}
          </Button>
          <Button
            onClick={handleCloseRoom}
            size="md"
            className="w-full min-w-0 px-[16px] text-[clamp(0.875rem,4.5vw,1rem)] md:px-6 md:text-base"
            variant="ghost"
          >
            Close room
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <Button
          disabled
          data-testid={E2E_TEST_IDS.lobbyWaitingForHostButton}
          size="lg"
          className={`h-auto min-h-[64px] w-full min-w-0 px-[16px] py-[12px] text-[clamp(1rem,5vw,1.125rem)] opacity-50 cursor-not-allowed md:min-h-16 md:px-8 md:text-lg ${className || ''}`}
          variant="secondary"
        >
          Waiting for host
        </Button>
        <Button
          onClick={handleLeaveLobby}
          size="md"
          className="w-full min-w-0 px-[16px] text-[clamp(0.875rem,4.5vw,1rem)] md:px-6 md:text-base"
          variant="ghost"
        >
          Leave room
        </Button>
      </div>
    );
  };

  return (
    <>
      {isPresenting && (
        <LobbyStage
          room={room}
          players={players}
          onExit={() => setIsPresenting(false)}
        />
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
        <div
          data-testid={E2E_TEST_IDS.lobbyScrollRegion}
          className="lj-safe-frame min-h-0 flex-1 overflow-y-auto overflow-x-hidden md:[--lj-safe-frame-space:3rem]"
        >
          <div className="mx-auto w-full max-w-3xl space-y-6 px-[16px] sm:px-6 md:space-y-8">
            <section className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[20px] shadow-[var(--shadow-sm)] sm:p-6">
              <div className="flex min-w-0 flex-col items-stretch gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-mono uppercase tracking-[0.2em] text-text-muted">
                    Room code
                  </p>
                  <p role="status" aria-live="polite" className="sr-only">
                    Room code {formatRoomCode(room.code)}
                  </p>
                  <p className="truncate font-[var(--font-display)] text-[clamp(2rem,16vw,3rem)] font-medium leading-none tracking-[0.08em] text-text-primary">
                    {formatRoomCode(room.code)}
                  </p>
                </div>
                <span className="min-w-0 max-w-full self-start whitespace-normal break-words rounded-full border border-border-subtle bg-background px-3 py-1 text-center text-xs font-mono uppercase tracking-wider text-text-muted sm:shrink-0 sm:self-auto">
                  {players.length}/8 seats
                </span>
              </div>
              <p className="mt-3 max-w-prose text-sm leading-relaxed text-text-secondary">
                Share the code, then start when everyone is ready.
              </p>
            </section>

            <section
              aria-labelledby="lobby-roster-heading"
              className="rounded-[var(--radius-xl)] border border-border-subtle bg-surface/60 p-[20px] sm:p-6"
            >
              <div className="flex min-w-0 flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
                <h2
                  id="lobby-roster-heading"
                  className="font-[var(--font-display)] text-xl font-medium text-text-primary"
                >
                  Players
                </h2>
                <span className="min-w-0 max-w-full self-start whitespace-normal break-words text-xs font-mono uppercase tracking-wider text-text-muted sm:shrink-0 sm:self-auto">
                  {players.length} in room
                </span>
              </div>

              <div className="relative mt-4 min-w-0">
                <ul className="flex min-w-0 max-w-full flex-wrap gap-2">
                  {players.map((player, i) => (
                    <StampAnimation
                      key={player._id}
                      delay={i * 150}
                      className="mx-[12px] min-w-0 max-w-[calc(100%-24px)] sm:mx-0 sm:max-w-full"
                    >
                      <li className="grid min-w-0 max-w-full grid-cols-1 items-center gap-x-2 gap-y-1 rounded-full border border-border bg-background/60 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                        <div className="flex min-w-0 max-w-full flex-1 items-center gap-2">
                          <Avatar
                            stableId={player.stableId}
                            displayName={player.displayName}
                            allStableIds={allStableIds}
                            size="md"
                          />
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary">
                            {player.displayName}
                          </span>
                          {player.isAway && (
                            <span className="shrink-0 text-[0.625rem] font-mono uppercase tracking-widest text-text-muted">
                              away
                            </span>
                          )}
                        </div>
                        <div className="flex min-w-0 max-w-full flex-wrap items-center justify-self-start gap-1.5 sm:justify-self-end">
                          {player.userId === room.hostUserId && <HostBadge />}
                        </div>
                      </li>
                    </StampAnimation>
                  ))}
                </ul>
              </div>
            </section>

            <details className="group rounded-[var(--radius-xl)] border border-border-subtle bg-surface/60">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-medium text-text-primary marker:hidden sm:px-6 [&::-webkit-details-marker]:hidden">
                <span>Room tools</span>
                <span
                  aria-hidden="true"
                  className="text-xl leading-none text-text-muted transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <div className="grid gap-6 border-t border-border-subtle p-5 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,16rem)] sm:items-start sm:p-6">
                <div className="flex min-w-0 justify-center sm:justify-start">
                  <LobbyJoinQr room={room} />
                </div>
                <div className="flex min-w-0 flex-col gap-3">
                  {isHost && (
                    <Button
                      type="button"
                      onClick={() => setIsPresenting(true)}
                      data-testid={E2E_TEST_IDS.lobbyPresentationButton}
                      variant="outline"
                      size="md"
                      className="h-auto min-h-[44px] w-full min-w-0 max-w-full px-[16px] py-[10px] text-[clamp(0.875rem,4.5vw,1rem)] md:min-h-11 md:px-6 md:text-base"
                    >
                      <Presentation className="mr-[8px] h-4 w-4" />
                      Present room
                    </Button>
                  )}
                </div>
              </div>
            </details>
          </div>
        </div>

        <div
          data-testid={E2E_TEST_IDS.lobbyActionZone}
          className="lj-safe-inline min-h-0 max-h-[50%] flex-[0_1_auto] overflow-y-auto border-t-2 border-primary/20 bg-background/95 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-lg)] backdrop-blur-md md:[--lj-safe-inline-space:3rem]"
        >
          <div className="mx-auto w-full max-w-sm">
            {error && (
              <Alert variant="error" className="mb-4">
                {error}
              </Alert>
            )}
            {renderButton()}
          </div>
        </div>
      </div>
    </>
  );
}
