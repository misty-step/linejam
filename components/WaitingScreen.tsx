import { useEffect, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { GHOSTWRITER_OVERTIME_MS } from '../convex/lib/gameRules';
import { useRoomQueryArgs } from '../hooks/useRoomQueryArgs';
import { captureError } from '../lib/error';
import { E2E_TEST_IDS } from '../lib/e2eTestIds';
import { errorToFeedback } from '../lib/errorFeedback';
import { Alert } from './ui/Alert';
import { Button } from './ui/Button';
import { LoadingState, LoadingMessages } from './ui/LoadingState';
import { RoundClock } from './ui/RoundClock';
import { Avatar } from './ui/Avatar';
import { BotBadge } from './ui/BotBadge';

interface WaitingScreenProps {
  roomCode: string;
  guestToken?: string | null;
  isLateJoiner?: boolean;
  progressOverride?: {
    round: number;
    roundStartedAt?: number;
    isHost?: boolean;
    players: Array<{
      submitted: boolean;
      userId: string;
      stableId: string;
      displayName: string;
      isBot?: boolean;
      isAway?: boolean;
    }>;
  } | null;
}

/** Re-render cadence for the overtime check; coarse on purpose. */
const OVERTIME_TICK_MS = 5_000;

export function WaitingScreen({
  roomCode,
  guestToken: propToken,
  isLateJoiner = false,
  progressOverride,
}: WaitingScreenProps) {
  // Use prop token if provided (from parent component), otherwise use hook token
  // This allows immediate query execution when transitioning from WritingScreen
  const { queryArgs, guestToken } = useRoomQueryArgs(roomCode, propToken);
  const queriedProgress = useQuery(
    api.game.getRoundProgress,
    progressOverride === undefined ? queryArgs : 'skip'
  );
  const progress =
    progressOverride === undefined ? queriedProgress : progressOverride;

  const summonGhostwriter = useMutation(api.game.summonGhostwriter);
  const [ghostState, setGhostState] = useState<'idle' | 'summoning' | 'sent'>(
    'idle'
  );
  const [ghostError, setGhostError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const roundStartedAt = progress?.roundStartedAt;
  useEffect(() => {
    if (!roundStartedAt) return;
    const interval = setInterval(() => setNow(Date.now()), OVERTIME_TICK_MS);
    return () => clearInterval(interval);
  }, [roundStartedAt]);

  // Loading state (query in flight or skipped)
  if (progress === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)]">
        <LoadingState message={LoadingMessages.LOADING_ROOM} />
      </div>
    );
  }

  // Round just resolved (game completed) or access changed — stay neutral;
  // the room page swaps to the right phase on the same state update.
  if (progress === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)]">
        <LoadingState message={LoadingMessages.LOADING_ROOM} />
      </div>
    );
  }

  const { round, players } = progress;
  const submittedCount = players.filter((p) => p.submitted).length;
  const allSubmitted = submittedCount === players.length;
  const waitingNames = players
    .filter((p) => !p.submitted)
    .map((p) => (p.isAway ? `${p.displayName} (away)` : p.displayName));

  const isOvertime =
    typeof progress.roundStartedAt === 'number' &&
    now - progress.roundStartedAt >= GHOSTWRITER_OVERTIME_MS;
  const showGhostwriter =
    !allSubmitted && isOvertime && progress.isHost === true;

  const handleSummonGhostwriter = async () => {
    setGhostError(null);
    setGhostState('summoning');
    try {
      await summonGhostwriter({
        roomCode,
        guestToken: guestToken || undefined,
      });
      setGhostState('sent');
    } catch (err) {
      captureError(err, { roomCode, operation: 'summonGhostwriter' });
      setGhostError(errorToFeedback(err).message);
      setGhostState('idle');
    }
  };

  // For unique avatar colors
  const allStableIds = players.map((p) => p.stableId);

  return (
    <div
      data-testid={E2E_TEST_IDS.waitingPhase}
      data-round={round + 1}
      className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-background)] p-8 md:p-12"
    >
      {/* Floating vertical composition - massive breathing space */}
      <div
        className="w-full max-w-2xl flex flex-col items-center"
        style={{ minHeight: '72vh' }}
      >
        {/* Late-joiner explanation */}
        {isLateJoiner && (
          <div className="flex-none mb-8 text-center">
            <p className="text-sm font-mono uppercase tracking-wider text-[var(--color-primary)]">
              Game in progress
            </p>
            <p className="mt-2 text-base text-[var(--color-text-secondary)]">
              You&apos;re in for the next round. Sit tight.
            </p>
          </div>
        )}

        {/* Center: Headline */}
        <div className="flex-none mb-24 md:mb-28 text-center space-y-6">
          <h2 className="text-6xl md:text-8xl font-[var(--font-display)] leading-[1.05]">
            {allSubmitted
              ? 'Ready'
              : isOvertime
                ? 'Still writing…'
                : 'Others are writing...'}
          </h2>
          {!allSubmitted && (
            <div className="space-y-3">
              <p className="text-[var(--text-lg)] font-mono text-[var(--color-text-secondary)]">
                Round {round + 1} · {submittedCount} of {players.length} ready
              </p>
              <p
                className="text-base text-[var(--color-text-muted)]"
                aria-live="polite"
              >
                {isOvertime
                  ? `Taking their time: ${waitingNames.join(', ')}`
                  : `Waiting on ${waitingNames.join(', ')}`}
              </p>
              {typeof progress.roundStartedAt === 'number' && (
                <div className="mx-auto max-w-xs pt-2">
                  <RoundClock roundStartedAt={progress.roundStartedAt} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Center-bottom: Poet presence indicators */}
        <div className="flex-1 flex items-start justify-center w-full mb-12">
          <div className="flex flex-wrap gap-4 md:gap-5 justify-center max-w-xl">
            {players.map((player, index) => (
              <div
                key={player.userId}
                className="relative"
                style={{
                  animationDelay: `${index * 100}ms`,
                }}
              >
                <div className="flex flex-col items-center gap-1.5">
                  {player.submitted ? (
                    <div className="opacity-50 transition-opacity duration-[var(--duration-normal)]">
                      <Avatar
                        stableId={player.stableId}
                        displayName={player.displayName}
                        allStableIds={allStableIds}
                        size="sm"
                      />
                    </div>
                  ) : (
                    <div
                      className={`relative ${player.isAway ? 'opacity-40' : ''}`}
                    >
                      <Avatar
                        stableId={player.stableId}
                        displayName={player.displayName}
                        allStableIds={allStableIds}
                        size="sm"
                      />
                      {!player.isAway && (
                        <div
                          className="absolute inset-0 -m-0.5 rounded-full border border-current opacity-0"
                          style={{
                            animation: 'avatar-pulse 2s ease-out infinite',
                            color: 'var(--color-primary)',
                          }}
                        />
                      )}
                    </div>
                  )}
                  <span
                    className={`text-[11px] font-medium leading-tight text-center max-w-[72px] truncate ${player.submitted ? 'text-[var(--color-text-muted)] line-through' : 'text-[var(--color-text-primary)]'}`}
                  >
                    {player.displayName}
                  </span>
                  {player.isBot && <BotBadge showLabel={false} />}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Host rescue: pass a stalled turn to the ghostwriter */}
        {showGhostwriter && (
          <div className="flex-none w-full max-w-sm space-y-3 text-center animate-fade-in-up">
            {ghostError && <Alert variant="error">{ghostError}</Alert>}
            {ghostState === 'sent' ? (
              <p className="text-sm text-[var(--color-text-muted)]">
                The ghostwriter is writing…
              </p>
            ) : (
              <>
                <Button
                  onClick={handleSummonGhostwriter}
                  disabled={ghostState === 'summoning'}
                  variant="outline"
                  size="md"
                  className="w-full"
                >
                  {ghostState === 'summoning'
                    ? 'Summoning…'
                    : 'Summon the ghostwriter'}
                </Button>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Covers the missing line so the room keeps moving.
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* CSS for avatar pulse animation */}
      <style jsx>{`
        @keyframes avatar-pulse {
          0% {
            transform: scale(1);
            opacity: 0.6;
          }
          100% {
            transform: scale(1.8);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
