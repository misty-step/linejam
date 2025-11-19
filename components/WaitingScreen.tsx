import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';

interface WaitingScreenProps {
  roomCode: string;
}

export function WaitingScreen({ roomCode }: WaitingScreenProps) {
  const progress = useQuery(api.game.getRoundProgress, { roomCode });

  if (!progress) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)]">
        <span className="text-[var(--color-text-muted)]">Loading...</span>
      </div>
    );
  }

  const { round, players } = progress;
  const submittedCount = players.filter((p) => p.submitted).length;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-background)] p-6">
      <Card className="w-full max-w-sm animate-fade-in">
        <CardHeader>
          <CardTitle className="text-center">Round {round + 1}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center space-y-2">
            <h3 className="text-xl font-medium text-[var(--color-text-primary)]">
              Waiting for everyone...
            </h3>
            <p className="text-[var(--color-text-muted)]">
              {submittedCount} of {players.length} players ready
            </p>
          </div>

          <div className="space-y-2">
            {players.map((player) => (
              <div
                key={player.userId}
                className="flex items-center justify-between bg-[var(--color-surface)] border border-[var(--color-border)] px-4 py-3 rounded-[var(--radius-md)]"
              >
                <span className="font-medium text-[var(--color-text-primary)]">
                  {player.displayName}
                </span>
                {player.submitted ? (
                  <span className="text-[var(--color-success)] flex items-center gap-1.5 text-sm">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    Done
                  </span>
                ) : (
                  <span className="text-[var(--color-text-muted)] flex items-center gap-1.5 text-sm">
                    <svg
                      className="w-4 h-4 animate-pulse"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                      />
                    </svg>
                    Writing
                  </span>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
