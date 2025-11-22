import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';

interface WaitingScreenProps {
  roomCode: string;
}

export function WaitingScreen({ roomCode }: WaitingScreenProps) {
  const progress = useQuery(api.game.getRoundProgress, { roomCode });

  if (!progress) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)]">
        <div className="animate-pulse w-2 h-2 bg-[var(--color-foreground)] rounded-full" />
      </div>
    );
  }

  const { round, players } = progress;
  const submittedCount = players.filter((p) => p.submitted).length;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-background)] p-6">
      <div className="w-full max-w-md space-y-12">
        <div className="text-center space-y-4">
          <p className="text-xs font-mono uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
            Round {round + 1} Pending
          </p>
          <h2 className="text-4xl md:text-5xl font-[var(--font-display)] leading-tight">
            Waiting for
            <br />
            Other Poets
          </h2>
          <p className="text-lg text-[var(--color-text-secondary)] font-mono">
            {submittedCount} / {players.length}
          </p>
        </div>

        <div className="border-t border-b border-[var(--color-border)] py-4 space-y-2">
          {players.map((player) => (
            <div
              key={player.userId}
              className="flex items-center justify-between py-2 px-2"
            >
              <span
                className={`font-medium text-lg ${player.submitted ? 'text-[var(--color-text-muted)] line-through' : 'text-[var(--color-text-primary)]'}`}
              >
                {player.displayName}
              </span>

              {player.submitted ? (
                <span className="text-xs font-mono uppercase tracking-widest text-[var(--color-primary)]">
                  [SEALED]
                </span>
              ) : (
                <span className="text-xs font-mono uppercase tracking-widest text-[var(--color-text-muted)] animate-pulse">
                  WRITING...
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="text-center">
          <p className="text-xs text-[var(--color-text-muted)] italic">
            &ldquo;Poetry is a political act because it involves telling the
            truth.&rdquo;
          </p>
        </div>
      </div>
    </div>
  );
}
