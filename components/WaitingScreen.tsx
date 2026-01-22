import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { useRoomQueryArgs } from '../hooks/useRoomQueryArgs';
import { LoadingState, LoadingMessages } from './ui/LoadingState';
import { Avatar } from './ui/Avatar';
import { BotBadge } from './ui/BotBadge';

interface WaitingScreenProps {
  roomCode: string;
  guestToken?: string | null;
}

export function WaitingScreen({
  roomCode,
  guestToken: propToken,
}: WaitingScreenProps) {
  // Use prop token if provided (from parent component), otherwise use hook token
  // This allows immediate query execution when transitioning from WritingScreen
  const { queryArgs } = useRoomQueryArgs(roomCode, propToken);
  const progress = useQuery(api.game.getRoundProgress, queryArgs);

  // Loading state (query in flight or skipped)
  if (progress === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)]">
        <LoadingState message={LoadingMessages.LOADING_ROOM} />
      </div>
    );
  }

  // Unauthorized or room not found (query returned null)
  if (progress === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)]">
        <p className="text-[var(--color-text-secondary)]">Room not found</p>
      </div>
    );
  }

  const { round, players } = progress;
  const submittedCount = players.filter((p) => p.submitted).length;
  const allSubmitted = submittedCount === players.length;

  // For unique avatar colors
  const allStableIds = players.map((p) => p.stableId);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-background)] p-8 md:p-12">
      {/* Floating vertical composition - massive breathing space */}
      <div
        className="w-full max-w-2xl flex flex-col items-center"
        style={{ minHeight: '80vh' }}
      >
        {/* Top: Round indicator */}
        <div className="flex-none mb-32 md:mb-40">
          <div className="text-[var(--text-sm)] font-mono text-[var(--color-text-muted)] uppercase tracking-[0.4em] text-center">
            Round {round + 1}
          </div>
        </div>

        {/* Center: Headline */}
        <div className="flex-none mb-24 md:mb-32 text-center space-y-6">
          <h2 className="text-6xl md:text-8xl font-[var(--font-display)] leading-[1.05]">
            {allSubmitted ? 'Ready' : 'Others are writing...'}
          </h2>
          {!allSubmitted && (
            <p className="text-[var(--text-lg)] font-mono text-[var(--color-text-secondary)]">
              {submittedCount} of {players.length} ready
            </p>
          )}
        </div>

        {/* Center-bottom: Poet presence indicators */}
        <div className="flex-1 flex items-start justify-center w-full mb-20">
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
