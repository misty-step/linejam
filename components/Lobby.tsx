import { useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { useUser } from '../lib/auth';
import { formatRoomCode } from '../lib/roomCode';
import { Button } from './ui/Button';
import { Label } from './ui/Label';
import { Doc } from '../convex/_generated/dataModel';
import { RoomQr } from './RoomQr';

interface LobbyProps {
  room: Doc<'rooms'>;
  players: Doc<'roomPlayers'>[];
  isHost: boolean;
}

export function Lobby({ room, players, isHost }: LobbyProps) {
  const { guestToken } = useUser();
  const startGameMutation = useMutation(api.game.startGame);

  const handleStartGame = async () => {
    if (!room) return;
    try {
      await startGameMutation({
        code: room.code,
        guestToken: guestToken || undefined,
      });
    } catch (error) {
      console.error('Failed to start game:', error);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-background)] p-6 md:p-12 flex flex-col md:flex-row gap-12">
      {/* Left: Room Info (Sticky) */}
      <div className="md:w-1/3 space-y-8">
        <div>
          <Label className="block mb-2">Room Code</Label>
          <h1 className="text-6xl md:text-8xl font-[var(--font-display)] text-[var(--color-primary)] tracking-tighter">
            {formatRoomCode(room.code)}
          </h1>
        </div>

        <div className="p-6 border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]">
          <h3 className="font-[var(--font-display)] text-2xl mb-2">Protocol</h3>
          <p className="text-[var(--color-text-secondary)] leading-relaxed">
            Wait for all poets to gather. Once the session begins, you will
            write blindly, seeing only the previous line. Trust the process.
          </p>
        </div>

        {isHost && <RoomQr roomCode={room.code} className="mt-8" />}
      </div>

      {/* Right: Player Manifest */}
      <div className="md:w-2/3 max-w-2xl">
        <div className="border-b-2 border-[var(--color-border)] pb-4 mb-8 flex justify-between items-end">
          <h2 className="text-3xl font-[var(--font-display)]">Manifest</h2>
          <span className="font-mono text-sm bg-[var(--color-primary)] text-white px-2 py-1">
            {players.length} Poet{players.length !== 1 ? 's' : ''}
          </span>
        </div>

        <ul className="space-y-4 mb-12">
          {players.map((player, i) => (
            <li
              key={player._id}
              className="flex items-center justify-between p-4 border border-[var(--color-border-subtle)] bg-[var(--color-surface)] animate-type"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="flex items-center gap-4">
                <span className="font-mono text-[var(--color-text-muted)] w-6">
                  {(i + 1).toString().padStart(2, '0')}
                </span>
                <span className="text-lg font-medium">
                  {player.displayName}
                </span>
              </div>
              {player.userId === room.hostUserId && (
                <span className="text-xs font-mono uppercase tracking-wider border border-[var(--color-primary)] text-[var(--color-primary)] px-2 py-1">
                  Host
                </span>
              )}
            </li>
          ))}
        </ul>

        <div className="flex gap-4 items-center border-t border-[var(--color-border-subtle)] pt-8">
          {isHost ? (
            <Button
              onClick={handleStartGame}
              size="lg"
              className="flex-1 h-16 text-lg"
              disabled={players.length < 2}
            >
              {players.length < 2 ? 'Waiting for Poets...' : 'Begin Session'}
            </Button>
          ) : (
            <Button
              disabled
              size="lg"
              className="flex-1 h-16 text-lg opacity-50 cursor-not-allowed"
              variant="secondary"
            >
              Waiting for Host...
            </Button>
          )}

          <div className="text-xs font-mono text-[var(--color-text-muted)] max-w-[150px]">
            {isHost
              ? players.length < 2
                ? 'Minimum 2 players required to start.'
                : 'Ready to commence writing phase.'
              : 'The session will begin when the host is ready.'}
          </div>
        </div>
      </div>
    </div>
  );
}
