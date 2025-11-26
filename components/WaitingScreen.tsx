import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Label } from './ui/Label';
import { Stamp } from './ui/Stamp';
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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-background)] p-6">
      <div className="w-full max-w-md space-y-12">
        <div className="text-center space-y-4">
          <Label className="tracking-[0.2em]">Round {round + 1} Pending</Label>
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
                <Stamp type="sealed" size="sm" />
              ) : (
                <Label className="animate-pulse">WRITING...</Label>
              )}
            </div>
          ))}
        </div>

        <div className="text-center">
          <p className="text-xs text-[var(--color-text-muted)] italic">
            &ldquo;The poem is a little myth of man&rsquo;s capacity to make
            life meaningful.&rdquo; — Robert Penn Warren
          </p>
        </div>
      </div>
    </div>
  );
}
