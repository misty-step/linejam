import { useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { api } from '../convex/_generated/api';
import { Check, Eye, Moon, PencilLine } from 'lucide-react';
import { AVATAR_COLORS, type AvatarId } from '@/lib/avatars';
import {
  useRoomQueryArgs,
  type RoomQueryArgs,
} from '../hooks/useRoomQueryArgs';
import { E2E_TEST_IDS } from '../lib/e2eTestIds';
import { cn } from '../lib/utils';
import { Avatar } from './ui/Avatar';

type RoundProgressResult =
  FunctionReturnType<typeof api.game.getRoundProgress> | undefined;

function useDefaultRoundProgress(args: RoomQueryArgs): RoundProgressResult {
  return useQuery(api.game.getRoundProgress, args);
}

export interface WaitingScreenDependencies {
  useRoomQueryArgs: typeof useRoomQueryArgs;
  useRoundProgress: typeof useDefaultRoundProgress;
}

const defaultDependencies: WaitingScreenDependencies = {
  useRoomQueryArgs,
  useRoundProgress: useDefaultRoundProgress,
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
  const { queryArgs } = dependencies.useRoomQueryArgs(roomCode, propToken);
  const queriedProgress = dependencies.useRoundProgress(
    progressOverride === undefined ? queryArgs : 'skip'
  );
  const progress =
    progressOverride === undefined ? queriedProgress : progressOverride;
  const players = progress?.players ?? [];
  const activePlayers = players.filter((player) => !player.isSpectator);
  const allSubmitted =
    activePlayers.length > 0 &&
    activePlayers.every((player) => player.submitted);
  const allStableIds = players.map((player) => player.stableId);
  const heading = isLateJoiner
    ? "You're in for the next game."
    : (acknowledgement ??
      (progress == null
        ? 'Gathering this round.'
        : allSubmitted
          ? progress.round + 1 >= (progress.totalRounds ?? 9)
            ? 'Ready to read.'
            : 'Next round…'
          : 'The poem is taking shape.'));

  return (
    <div
      data-testid={
        progress != null || acknowledgement
          ? E2E_TEST_IDS.waitingPhase
          : undefined
      }
      data-round={progress == null ? undefined : progress.round + 1}
      className={cn(
        'lj-safe-frame flex flex-col items-center overflow-x-hidden overflow-y-auto overscroll-contain',
        embedded ? 'min-h-0 flex-1' : 'lj-game-viewport'
      )}
    >
      <div
        data-testid="waiting-screen"
        className="my-auto w-full max-w-xl space-y-7 py-5 sm:space-y-8 sm:py-8"
      >
        <div>
          <div
            aria-hidden="true"
            className="relative mx-auto mb-4 h-[112px] w-[176px]"
          >
            <div className="lj-waiting-print absolute inset-x-[4px] top-[12px] bottom-[4px]" />
            <Avatar
              stableId="waiting-character"
              displayName="Moss"
              avatarId="moss"
              size="xl"
              className="absolute top-[4px] left-[12px] -rotate-6"
            />
            <svg
              viewBox="0 0 104 92"
              className={cn(
                'absolute right-[4px] bottom-0 h-[92px] w-[104px]',
                acknowledgement && 'lj-waiting-settle'
              )}
              fill="none"
              focusable="false"
            >
              <path
                d="M12 59c5-8 49-10 66-4 15 5 17 19 3 25-15 6-63 6-72-2-5-5-3-13 3-19Z"
                fill={AVATAR_COLORS.mint}
              />
              <path
                d="m28 15 39 3 14 16-5 39-53-4 5-54Z"
                fill="var(--color-surface)"
                stroke="var(--color-text-primary)"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <path
                d="m67 18-1 16h15"
                fill={AVATAR_COLORS.peach}
                stroke="var(--color-text-primary)"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <path
                d="m37 39 19 2m-21 9 30 2m-29 9 19 1"
                stroke="var(--color-text-primary)"
                strokeWidth="2"
                strokeLinecap="round"
                opacity=".45"
              />
              <circle cx="87" cy="12" r="5" fill={AVATAR_COLORS.peach} />
            </svg>
          </div>
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            aria-busy={progress == null && !acknowledgement ? true : undefined}
            className="space-y-2 text-center"
          >
            <h2 className="font-display text-2xl font-medium leading-snug text-text-primary sm:text-3xl">
              {heading}
            </h2>
            {progress != null && (
              <p className="text-sm text-text-secondary">
                Round {progress.round + 1} of {progress.totalRounds ?? 9}
              </p>
            )}
            {progress == null && !acknowledgement && (
              <p className="text-sm text-text-secondary">
                Loading the player list…
              </p>
            )}
          </div>
        </div>
        {progress != null && (
          <ul
            className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,7rem),1fr))] items-start gap-x-3 gap-y-6"
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
                  className="flex min-w-0 flex-col items-center"
                >
                  <Avatar
                    stableId={player.stableId}
                    displayName={player.displayName}
                    avatarId={player.avatarId}
                    allStableIds={allStableIds}
                    size="lg"
                    outlined={player.isSpectator}
                  />
                  <span className="mt-2 w-full text-center text-sm font-semibold leading-tight [overflow-wrap:anywhere]">
                    {player.displayName}
                  </span>
                  <span
                    className={cn(
                      'mt-1 inline-flex items-center gap-1 text-xs leading-snug',
                      player.submitted && !player.isSpectator
                        ? 'text-success'
                        : 'text-text-secondary'
                    )}
                  >
                    <StatusIcon
                      className="h-3 w-3 shrink-0"
                      aria-hidden="true"
                    />
                    {status}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
