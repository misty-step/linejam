'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from 'convex/react';
import type { FunctionArgs, FunctionReturnType } from 'convex/server';
import { api } from '../convex/_generated/api';
import { useUser } from '../lib/auth';
import { E2E_TEST_IDS } from '../lib/e2eTestIds';
import { errorToFeedback } from '../lib/errorFeedback';
import { toErrorReportable } from '../lib/errorCore';
import { formatRoomCode } from '../lib/roomCode';
import { Alert } from './ui/Alert';
import { Avatar } from './ui/Avatar';
import { Button } from './ui/Button';
import { HostBadge } from './ui/HostBadge';
import { LobbyJoinQr, LobbyStage } from './stage/LobbyStage';
import { Doc } from '../convex/_generated/dataModel';
import { Presentation } from 'lucide-react';
import {
  hashRoomId,
  trackGameStarted,
  trackLobbyReady,
} from '../lib/analytics';

/**
 * The roster scrolls independently of the in-flow start/leave actions.
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
  useUser: typeof useUser;
  useStartGame: () => StartGame;
  useLeaveLobby: () => LeaveLobby;
  useCloseRoom: () => CloseRoom;
  hashRoomId: typeof hashRoomId;
  trackGameStarted: typeof trackGameStarted;
  trackLobbyReady: typeof trackLobbyReady;
}

const defaultDependencies: LobbyDependencies = {
  useRouter,
  useUser,
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
  dependencies?: LobbyDependencies;
}

export function Lobby({
  room,
  players,
  isHost,
  dependencies = defaultDependencies,
}: LobbyProps) {
  const router = dependencies.useRouter();
  const { guestToken } = dependencies.useUser();
  const startGameMutation = dependencies.useStartGame();
  const leaveLobbyMutation = dependencies.useLeaveLobby();
  const closeRoomMutation = dependencies.useCloseRoom();
  const [error, setError] = useState<string | null>(null);
  const [isPresenting, setIsPresenting] = useState(false);

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

  const renderActions = () => {
    if (isHost) {
      return (
        <div className="space-y-2">
          <Button
            onClick={handleStartGame}
            data-testid={E2E_TEST_IDS.lobbyStartGameButton}
            size="lg"
            className="h-auto min-h-[56px] w-full min-w-0 px-[16px] py-[12px] text-base"
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
            className="h-auto min-h-[44px] w-full min-w-0 px-[16px] py-[8px] text-base"
            variant="ghost"
          >
            Close room
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <Button
          disabled
          data-testid={E2E_TEST_IDS.lobbyWaitingForHostButton}
          size="lg"
          className="h-auto min-h-[56px] w-full min-w-0 px-[16px] py-[12px] text-base"
          variant="secondary"
        >
          Waiting for host
        </Button>
        <Button
          onClick={handleLeaveLobby}
          size="md"
          className="h-auto min-h-[44px] w-full min-w-0 px-[16px] py-[8px] text-base"
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
          className="lj-safe-frame min-h-0 flex-1 overflow-y-auto overflow-x-hidden md:[--lj-safe-frame-space:1.5rem]"
        >
          <div className="mx-auto w-full max-w-2xl space-y-6">
            <section
              aria-label="Room code"
              className="flex min-w-0 flex-wrap items-end justify-between gap-4"
            >
              <div className="min-w-0">
                <p className="mb-1 text-sm text-text-secondary">Room code</p>
                <p className="break-words text-4xl font-bold leading-tight tracking-wide text-text-primary sm:text-5xl">
                  {formatRoomCode(room.code)}
                </p>
              </div>
              <details className="group min-w-0">
                <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full px-3 py-2 text-base font-semibold text-primary marker:hidden hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring [&::-webkit-details-marker]:hidden">
                  <span>Show QR code</span>
                  <span aria-hidden="true" className="group-open:rotate-45">
                    +
                  </span>
                </summary>
                <div className="pt-3">
                  <LobbyJoinQr room={room} />
                </div>
              </details>
            </section>

            <section
              aria-labelledby="lobby-roster-heading"
              className="min-w-0 overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border-subtle px-4 py-3 sm:px-5">
                <h2
                  id="lobby-roster-heading"
                  className="text-lg font-bold text-text-primary"
                >
                  Players
                </h2>
                <p
                  className="text-sm text-text-secondary"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  {players.length} of 8
                </p>
              </div>

              <ul className="min-w-0 divide-y divide-border-subtle">
                {players.map((player) => (
                  <li
                    key={player._id}
                    className="flex min-w-0 items-center gap-3 px-4 py-3 sm:px-5"
                  >
                    <Avatar
                      stableId={player.stableId}
                      avatarId={player.avatarId}
                      displayName={player.displayName}
                      allStableIds={allStableIds}
                      size="md"
                    />
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="min-w-0 break-words text-base font-semibold text-text-primary [overflow-wrap:anywhere]">
                        {player.displayName}
                      </span>
                      {player.userId === room.hostUserId && <HostBadge />}
                      {player.isAway && (
                        <span className="text-sm text-text-secondary">
                          Away
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            {isHost && (
              <Button
                type="button"
                onClick={() => setIsPresenting(true)}
                data-testid={E2E_TEST_IDS.lobbyPresentationButton}
                variant="ghost"
                size="md"
                className="h-auto min-h-11 max-w-full px-3 py-2 text-base"
              >
                <Presentation
                  className="mr-2 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                Present room
              </Button>
            )}
          </div>
        </div>

        <div
          data-testid={E2E_TEST_IDS.lobbyActionZone}
          className="lj-safe-inline min-h-0 max-h-[50%] flex-[0_1_auto] overflow-y-auto border-t border-border bg-background pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:[--lj-safe-inline-space:1.5rem]"
        >
          <div className="mx-auto w-full max-w-sm">
            {error && (
              <Alert variant="error" className="mb-4">
                {error}
              </Alert>
            )}
            {renderActions()}
          </div>
        </div>
      </div>
    </>
  );
}
