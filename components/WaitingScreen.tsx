import { useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { api } from '../convex/_generated/api';
import type { StoredAvatarId } from '@/lib/avatars';
import {
  useRoomQueryArgs,
  type RoomQueryArgs,
} from '../hooks/useRoomQueryArgs';
import { E2E_TEST_IDS } from '../lib/e2eTestIds';
import { cn } from '../lib/utils';
import { Avatar, type AvatarMood, type AvatarProp } from './ui/Avatar';

type PlayerState = { label: string; mood: AvatarMood; prop?: AvatarProp };

// The written status stays; the character's face and prop echo it.
const TUCKED_IN: PlayerState = {
  label: 'Submitted',
  mood: 'tucked',
  prop: 'note',
};
const WRITING: PlayerState = {
  label: 'Writing',
  mood: 'writing',
  prop: 'pencil',
};
const AWAY: PlayerState = { label: 'Away', mood: 'away', prop: 'moon' };
const WATCHING: PlayerState = { label: 'Watching', mood: 'watching' };

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
      avatarId?: StoredAvatarId;
      isViewer?: boolean;
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
  // Your own character holds your note while the round finishes.
  const viewer = players.find((player) => player.isViewer);
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
            {viewer && (
              <Avatar
                stableId={viewer.stableId}
                displayName={viewer.displayName}
                avatarId={viewer.avatarId}
                size="hero"
                mood={isLateJoiner ? 'watching' : 'tucked'}
                prop={isLateJoiner ? undefined : 'note'}
                className={cn(
                  'absolute top-0 left-[32px]',
                  acknowledgement && 'lj-waiting-settle'
                )}
              />
            )}
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
              const state = player.isSpectator
                ? WATCHING
                : player.submitted
                  ? TUCKED_IN
                  : player.isAway
                    ? AWAY
                    : WRITING;
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
                    mood={state.mood}
                    prop={state.prop}
                    outlined={player.isSpectator}
                  />
                  <span className="mt-2 w-full text-center text-sm font-semibold leading-tight [overflow-wrap:anywhere]">
                    {player.displayName}
                  </span>
                  <span
                    className={cn(
                      'mt-1 text-xs leading-snug',
                      state === TUCKED_IN
                        ? 'text-success'
                        : 'text-text-secondary'
                    )}
                  >
                    {state.label}
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
