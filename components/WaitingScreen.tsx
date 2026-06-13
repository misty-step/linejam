import { useEffect, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { GHOSTWRITER_OVERTIME_MS } from '../convex/lib/gameRules';
import { useRoomQueryArgs } from '../hooks/useRoomQueryArgs';
import { captureError } from '../lib/error';
import { errorToFeedback } from '../lib/errorFeedback';
import { Alert } from './ui/Alert';
import { Button } from './ui/Button';
import { LoadingState, LoadingMessages } from './ui/LoadingState';
import { Avatar } from './ui/Avatar';
import { BotBadge } from './ui/BotBadge';

interface WaitingScreenProps {
  roomCode: string;
  guestToken?: string | null;
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
    }>;
  } | null;
}

/** Re-render cadence for the overtime check; coarse on purpose. */
const OVERTIME_TICK_MS = 5_000;

export function WaitingScreen({
  roomCode,
  guestToken: propToken,
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
    .map((p) => p.displayName);

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
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-background)] p-8 md:p-12">
      {/* Floating vertical composition - massive breathing space */}
      <div
        className="w-full max-w-2xl flex flex-col items-center"
        style={{ minHeight: '72vh' }}
      >
        {/* Center: Headline */}
        <div className="flex-none mb-24 md:mb-28 text-center space-y-6">
          <h2 className="text-6xl md:text-8xl font-[var(--font-display)] leading-[1.05]">
            {allSubmitted ? 'Ready' : 'Others are writing...'}
          </h2>
          {!allSubmitted && (
            <div className="space-y-2">
              <p className="text-[var(--text-lg)] font-mono text-[var(--color-text-secondary)]">
                Round {round + 1} · {submittedCount} of {players.length} ready
              </p>
              <p
                className="text-base text-[var(--color-text-muted)]"
                aria-live="polite"
              >
                Waiting on {waitingNames.join(', ')}
              </p>
            </div>
          )}
        </div>

        {/* Center-bottom: Poet presence indicators */}
        <div className="flex-1 flex items-start justify-center w-full mb-12">
          <div className="flex flex-wrap gap-4 md:gap-5 justify-center max-w-xl">
            {players.map((player, index) => (
              <div
                key={player.userId}
                className="relative group"
                style={{
                  animationDelay: `${index * 100}ms`,
                }}
              >
                {player.submitted ? (
                  // Settled - subdued avatar
                  <div className="opacity-50 transition-opacity duration-[var(--duration-normal)]">
                    <Avatar
                      stableId={player.stableId}
                      displayName={player.displayName}
                      allStableIds={allStableIds}
                      size="sm"
                    />
                  </div>
                ) : (
                  // Active - avatar with pulse ring
                  <div className="relative">
                    <Avatar
                      stableId={player.stableId}
                      displayName={player.displayName}
                      allStableIds={allStableIds}
                      size="sm"
                    />
                    {/* Pulse ring - scaled for tiny dots */}
                    <div
                      className="absolute inset-0 -m-0.5 rounded-full border border-current opacity-0"
                      style={{
                        animation: 'avatar-pulse 2s ease-out infinite',
                        color: 'var(--color-primary)',
                      }}
                    />
                  </div>
                )}
                {/* Name tooltip on hover */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                  <div className="bg-[var(--color-background)] border border-[var(--color-border)] px-3 py-1 rounded-full shadow-lg whitespace-nowrap flex items-center gap-1.5">
                    <span
                      className={`text-[var(--text-xs)] font-medium ${player.submitted ? 'text-[var(--color-text-secondary)] line-through' : 'text-[var(--color-text-primary)]'}`}
                    >
                      {player.displayName}
                    </span>
                    {player.isBot && <BotBadge showLabel={false} />}
                  </div>
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
