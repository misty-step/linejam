import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { LoadingState, LoadingMessages } from './ui/LoadingState';

interface WaitingScreenProps {
  roomCode: string;
}

export function WaitingScreen({ roomCode }: WaitingScreenProps) {
  const progress = useQuery(api.game.getRoundProgress, { roomCode });

  if (!progress) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)]">
        <LoadingState message={LoadingMessages.LOADING_ROOM} />
      </div>
    );
  }

  const { round, players } = progress;
  const submittedCount = players.filter((p) => p.submitted).length;
  const allSubmitted = submittedCount === players.length;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-background)] p-8 md:p-12">
      {/* Floating vertical composition - massive breathing space */}
      <div
        className="w-full max-w-2xl flex flex-col items-center"
        style={{ minHeight: '80vh' }}
      >
        {/* Top: Round indicator */}
        <div className="flex-none mb-32 md:mb-40">
          <div className="text-sm font-mono text-[var(--color-text-muted)] uppercase tracking-[0.4em] text-center">
            Round {round + 1}
          </div>
        </div>

        {/* Center: Headline */}
        <div className="flex-none mb-24 md:mb-32 text-center space-y-6">
          <h2 className="text-6xl md:text-8xl font-[var(--font-display)] leading-[1.05]">
            {allSubmitted ? 'Ready' : 'Others are writing...'}
          </h2>
          {!allSubmitted && (
            <p className="text-lg font-mono text-[var(--color-text-secondary)]">
              {submittedCount} of {players.length} ready
            </p>
          )}
        </div>

        {/* Center-bottom: Poet presence indicators */}
        <div className="flex-1 flex items-start justify-center w-full mb-20">
          <div className="flex flex-wrap gap-10 md:gap-12 justify-center max-w-xl">
            {players.map((player, index) => (
              <div
                key={player.userId}
                className="relative"
                style={{
                  animationDelay: `${index * 100}ms`,
                }}
              >
                {player.submitted ? (
                  // Settled ink drop
                  <div className="group relative">
                    <div
                      className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-[var(--color-primary)] opacity-40 transition-opacity duration-500"
                      style={{
                        boxShadow: '0 0 12px rgba(232, 93, 43, 0.3)',
                      }}
                    />
                    {/* Name tooltip on hover */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                      <div className="bg-[var(--color-background)] border border-[var(--color-border)] px-3 py-1 rounded-full shadow-lg whitespace-nowrap">
                        <span className="text-xs font-medium text-[var(--color-text-secondary)] line-through">
                          {player.displayName}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  // Active ink - spreading ripple
                  <div className="group relative">
                    <div className="relative w-3 h-3 md:w-4 md:h-4">
                      {/* Core dot */}
                      <div className="absolute inset-0 rounded-full bg-[var(--color-primary)] animate-pulse" />
                      {/* Ripple rings */}
                      <div
                        className="absolute inset-0 -m-2 rounded-full border-2 border-[var(--color-primary)] opacity-0"
                        style={{
                          animation: 'ink-ripple 2s ease-out infinite',
                        }}
                      />
                      <div
                        className="absolute inset-0 -m-2 rounded-full border-2 border-[var(--color-primary)] opacity-0"
                        style={{
                          animation: 'ink-ripple 2s ease-out infinite 1s',
                        }}
                      />
                    </div>
                    {/* Name tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                      <div className="bg-[var(--color-background)] border border-[var(--color-primary)]/30 px-3 py-1 rounded-full shadow-lg whitespace-nowrap">
                        <span className="text-xs font-medium text-[var(--color-primary)]">
                          {player.displayName}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CSS for ink ripple animation */}
      <style jsx>{`
        @keyframes ink-ripple {
          0% {
            transform: scale(1);
            opacity: 0.6;
          }
          100% {
            transform: scale(3);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
