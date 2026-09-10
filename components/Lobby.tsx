'use client';

import { useRef, useState } from 'react';
import { useMutation } from 'convex/react';
import type { FunctionArgs, FunctionReturnType } from 'convex/server';
import { api } from '../convex/_generated/api';
import type { Doc } from '../convex/_generated/dataModel';
import { useUser } from '../lib/auth';
import { E2E_TEST_IDS } from '../lib/e2eTestIds';
import { errorToFeedback } from '../lib/errorFeedback';
import { toErrorReportable } from '../lib/errorCore';
import { playSound } from '@/lib/audio';
import {
  hashRoomId,
  trackGameStarted,
  trackLobbyReady,
} from '../lib/analytics';
import { Alert } from './ui/Alert';
import { Avatar } from './ui/Avatar';
import { Button } from './ui/Button';
import { HostBadge } from './ui/HostBadge';
import { RoomInvite } from './RoomInvite';

interface LobbyPlayer extends Doc<'roomPlayers'> {
  stableId: string;
  isAway?: boolean;
}

type StartGame = (
  args: FunctionArgs<typeof api.game.startGame>
) => Promise<FunctionReturnType<typeof api.game.startGame>>;

function useDefaultStartGame(): StartGame {
  return useMutation(api.game.startGame);
}

export interface LobbyDependencies {
  useUser: typeof useUser;
  useStartGame: () => StartGame;
  hashRoomId: typeof hashRoomId;
  trackGameStarted: typeof trackGameStarted;
  trackLobbyReady: typeof trackLobbyReady;
}

const defaultDependencies: LobbyDependencies = {
  useUser,
  useStartGame: useDefaultStartGame,
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

/** The roster scrolls independently of the one primary start action. */
export function Lobby({
  room,
  players,
  isHost,
  dependencies = defaultDependencies,
}: LobbyProps) {
  const { guestToken } = dependencies.useUser();
  const startGameMutation = dependencies.useStartGame();
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const startingRef = useRef(false);
  const canStart = players.length >= 2;

  const handleStartGame = async () => {
    if (!isHost || !canStart || startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    setError(null);
    try {
      await startGameMutation({
        code: room.code,
        guestToken: guestToken || undefined,
      });
      playSound('bloom');
      const analyticsProps = {
        roomIdHash: dependencies.hashRoomId(room._id),
        cycle: (room.currentCycle ?? 0) + 1,
      };
      dependencies.trackLobbyReady(analyticsProps);
      dependencies.trackGameStarted(analyticsProps);
    } catch (cause) {
      playSound('error');
      setError(errorToFeedback(toErrorReportable(cause)).message);
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <h1 className="sr-only">Room lobby</h1>
      <div
        data-testid={E2E_TEST_IDS.lobbyScrollRegion}
        className="lj-safe-inline min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-3 [--lj-safe-inline-space:1rem]"
      >
        <div className="mx-auto w-full max-w-xl space-y-6">
          <RoomInvite roomCode={room.code} />
          <section aria-labelledby="lobby-roster-heading" className="min-w-0">
            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2 px-1">
              <h2
                id="lobby-roster-heading"
                className="text-base font-bold text-text-primary"
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
            <ul
              aria-label="Players"
              className="min-w-0 divide-y divide-border-subtle"
            >
              {players.map((player) => (
                <li
                  key={player._id}
                  className="flex min-w-0 items-center gap-3 px-1 py-3"
                >
                  <Avatar
                    stableId={player.stableId}
                    avatarId={player.avatarId}
                    displayName={player.displayName}
                    size="md"
                  />
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="min-w-0 break-words text-base font-semibold text-text-primary [overflow-wrap:anywhere]">
                      {player.displayName}
                    </span>
                    {player.userId === room.hostUserId && <HostBadge />}
                    {player.isAway && (
                      <span className="text-sm text-text-secondary">Away</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
      <div
        data-testid={E2E_TEST_IDS.lobbyActionZone}
        className="lj-safe-inline min-h-0 max-h-[50%] flex-[0_1_auto] overflow-y-auto bg-background pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] [--lj-safe-inline-space:1rem]"
      >
        <div className="mx-auto w-full max-w-xl space-y-3">
          {error && <Alert variant="error">{error}</Alert>}
          {isHost ? (
            <Button
              onClick={() => void handleStartGame()}
              data-testid={E2E_TEST_IDS.lobbyStartGameButton}
              data-sound="loading"
              size="lg"
              className="min-h-14 w-full px-4 py-3 text-base"
              disabled={!canStart || starting}
              variant={canStart ? 'primary' : 'secondary'}
            >
              {starting
                ? 'Starting…'
                : canStart
                  ? 'Start Linejam'
                  : `Need ${2 - players.length} more player${players.length === 1 ? '' : 's'}`}
            </Button>
          ) : (
            <Button
              disabled
              data-testid={E2E_TEST_IDS.lobbyWaitingForHostButton}
              size="lg"
              className="min-h-14 w-full px-4 py-3 text-base"
              variant="secondary"
            >
              Waiting for host
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
