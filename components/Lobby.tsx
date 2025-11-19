import { useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { useUser } from '../lib/auth';
import { Button } from './ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Doc } from '../convex/_generated/dataModel';

interface LobbyProps {
  room: Doc<'rooms'>;
  players: Doc<'roomPlayers'>[];
}

export function Lobby({ room, players }: LobbyProps) {
  const { guestId } = useUser();
  const startGame = useMutation(api.game.startGame);

  const handleStart = async () => {
    try {
      await startGame({ code: room.code, guestId: guestId || undefined });
    } catch (error) {
      console.error('Failed to start game:', error);
      alert('Only the host can start the game!');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-background)] p-6">
      <Card className="w-full max-w-sm animate-fade-in">
        <CardHeader>
          <CardTitle className="text-center">
            Room: <span className="font-mono tracking-wider">{room.code}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-[var(--color-text-secondary)]">
              Players ({players.length})
            </h3>
            <ul className="space-y-2">
              {players.map((player) => (
                <li
                  key={player._id}
                  className="flex items-center justify-between bg-[var(--color-muted)] px-4 py-3 rounded-[var(--radius-md)]"
                >
                  <span className="text-[var(--color-text-primary)]">
                    {player.displayName}
                  </span>
                  {player.userId === room.hostUserId && (
                    <span className="text-xs font-medium text-[var(--color-primary)] bg-[var(--color-surface)] px-2 py-0.5 rounded-full border border-[var(--color-primary)]">
                      Host
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="pt-2">
            <Button
              onClick={handleStart}
              className="w-full"
              size="lg"
              disabled={players.length < 2}
            >
              Start Game
            </Button>
            {players.length < 2 && (
              <p className="text-xs text-center text-[var(--color-text-muted)] mt-3">
                Need at least 2 players
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
