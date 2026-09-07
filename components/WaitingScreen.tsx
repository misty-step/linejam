import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import type { FunctionArgs, FunctionReturnType } from 'convex/server';
import { api } from '../convex/_generated/api';
import { Check, Eye, Moon, PencilLine } from 'lucide-react';
import type { AvatarId } from '@/lib/avatars';
import {
  useRoomQueryArgs,
  type RoomQueryArgs,
} from '../hooks/useRoomQueryArgs';
import { captureError } from '../lib/error';
import { E2E_TEST_IDS } from '../lib/e2eTestIds';
import { errorToFeedback } from '../lib/errorFeedback';
import { toErrorReportable } from '../lib/errorCore';
import { cn } from '../lib/utils';
import { Alert } from './ui/Alert';
import { Button } from './ui/Button';
import { LoadingState, LoadingMessages } from './ui/LoadingState';
import { Avatar } from './ui/Avatar';

type RoundProgressResult =
  FunctionReturnType<typeof api.game.getRoundProgress> | undefined;
type EndGame = (
  args: FunctionArgs<typeof api.game.endGame>
) => Promise<FunctionReturnType<typeof api.game.endGame>>;

function useDefaultRoundProgress(args: RoomQueryArgs): RoundProgressResult {
  return useQuery(api.game.getRoundProgress, args);
}

function useDefaultEndGame(): EndGame {
  return useMutation(api.game.endGame);
}

export interface WaitingScreenDependencies {
  useRoomQueryArgs: typeof useRoomQueryArgs;
  useRoundProgress: typeof useDefaultRoundProgress;
  useEndGame: () => EndGame;
}

const defaultDependencies: WaitingScreenDependencies = {
  useRoomQueryArgs,
  useRoundProgress: useDefaultRoundProgress,
  useEndGame: useDefaultEndGame,
};

interface WaitingScreenProps {
  roomCode: string;
  guestToken?: string | null;
  embedded?: boolean;
  isLateJoiner?: boolean;
  acknowledgement?: string;
  progressOverride?: {
    round: number;
    totalRounds?: number;
    roundStartedAt?: number;
    isHost?: boolean;
    players: Array<{
      submitted: boolean;
      userId: string;
      stableId: string;
      displayName: string;
      avatarId?: AvatarId;
      isAway?: boolean;
      isSpectator?: boolean;
    }>;
  } | null;
  dependencies?: WaitingScreenDependencies;
}

export function WaitingScreen({
  roomCode,
  guestToken: propToken,
  embedded = false,
  isLateJoiner = false,
  progressOverride,
  acknowledgement,
  dependencies = defaultDependencies,
}: WaitingScreenProps) {
  // Use prop token if provided (from parent component), otherwise use hook token
  // This allows immediate query execution when transitioning from WritingScreen
  const { queryArgs, guestToken } = dependencies.useRoomQueryArgs(
    roomCode,
    propToken
  );
  const queriedProgress = dependencies.useRoundProgress(
    progressOverride === undefined ? queryArgs : 'skip'
  );
  const progress =
    progressOverride === undefined ? queriedProgress : progressOverride;

  const endGame = dependencies.useEndGame();
  const [endState, setEndState] = useState<'idle' | 'confirming' | 'ending'>(
    'idle'
  );
  const [endError, setEndError] = useState<string | null>(null);

  // Keep the confirmed acknowledgement while roster data catches up.
  if (progress === undefined || progress === null) {
    return (
      <div
        data-testid={acknowledgement ? E2E_TEST_IDS.waitingPhase : undefined}
        className={cn(
          'flex items-center justify-center p-4',
          embedded ? 'min-h-0 flex-1' : 'lj-game-viewport'
        )}
      >
        {acknowledgement ? (
          <p role="status" className="text-center text-xl font-semibold">
            {acknowledgement}
          </p>
        ) : (
          <LoadingState message={LoadingMessages.LOADING_ROOM} />
        )}
      </div>
    );
  }

  const { round, players } = progress;
  const activePlayers = players.filter((player) => !player.isSpectator);
  const allSubmitted = activePlayers.every((player) => player.submitted);

  const handleEndGame = async () => {
    setEndError(null);
    setEndState('ending');
    try {
      await endGame({
        roomCode,
        guestToken: guestToken || undefined,
      });
    } catch (cause) {
      const error = toErrorReportable(cause);
      captureError(error, { roomCode, operation: 'endGame' });
      setEndError(errorToFeedback(error).message);
      setEndState('confirming');
    }
  };

  const allStableIds = players.map((player) => player.stableId);
  const heading = isLateJoiner
    ? "You're in for the next game."
    : (acknowledgement ??
      (allSubmitted
        ? round + 1 >= (progress.totalRounds ?? 9)
          ? 'Ready to read.'
          : 'Next round…'
        : 'Your line is in.'));

  return (
    <div
      data-testid={E2E_TEST_IDS.waitingPhase}
      data-round={round + 1}
      className={cn(
        'lj-safe-frame flex flex-col items-center overflow-x-hidden',
        embedded ? 'min-h-0 flex-1 overflow-y-auto' : 'lj-game-viewport'
      )}
    >
      <div
        data-testid="waiting-screen"
        className="my-auto w-full max-w-md space-y-6 py-6"
      >
        <h2
          className="text-center font-sans text-xl font-semibold leading-snug md:text-2xl"
          aria-live="polite"
        >
          {heading}
        </h2>
        <span className="sr-only">
          Round {round + 1} of {progress.totalRounds ?? 9}
        </span>
        <ul
          className="grid grid-cols-4 items-start gap-x-3 gap-y-5"
          aria-label="Players this round"
        >
          {players.map((player) => {
            const status = player.isSpectator
              ? 'Watching'
              : player.submitted
                ? 'Submitted'
                : player.isAway
                  ? 'Away'
                  : 'Writing';
            const StatusIcon = player.isSpectator
              ? Eye
              : player.submitted
                ? Check
                : player.isAway
                  ? Moon
                  : PencilLine;
            return (
              <li
                key={player.userId}
                className="flex min-w-0 flex-col items-center gap-2"
              >
                <div className="relative">
                  <Avatar
                    stableId={player.stableId}
                    displayName={player.displayName}
                    avatarId={player.avatarId}
                    allStableIds={allStableIds}
                    size="lg"
                    outlined={player.isSpectator}
                  />
                  <span
                    className={cn(
                      'absolute -right-1 -bottom-1 flex h-6 w-6 items-center justify-center rounded-full border border-border-subtle bg-surface',
                      player.submitted && !player.isSpectator
                        ? 'text-success'
                        : 'text-text-secondary'
                    )}
                    title={status}
                  >
                    <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="sr-only">{status}</span>
                  </span>
                </div>
                <span className="w-full text-center text-sm font-semibold leading-tight [overflow-wrap:anywhere]">
                  {player.displayName}
                </span>
              </li>
            );
          })}
        </ul>
        {!allSubmitted && progress.isHost === true && (
          <div className="space-y-3 text-center">
            {endError && <Alert variant="error">{endError}</Alert>}
            {endState === 'confirming' || endState === 'ending' ? (
              <div className="space-y-4 rounded-lg bg-surface p-4 text-left">
                <h3 className="font-sans text-lg font-semibold">
                  End this game?
                </h3>
                <p className="text-sm text-text-secondary">
                  Everyone returns to the lobby. Partial poems stay private.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={() => setEndState('idle')}
                    disabled={endState === 'ending'}
                    variant="outline"
                  >
                    Keep playing
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void handleEndGame()}
                    disabled={endState === 'ending'}
                  >
                    {endState === 'ending' ? 'Ending game…' : 'End game'}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                onClick={() => setEndState('confirming')}
                variant="ghost"
                size="sm"
              >
                End game
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
