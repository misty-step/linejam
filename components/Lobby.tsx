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

  // Determine if current user is host
  // We need to match the user ID.
  // Since we don't have the full user object here easily without another query,
  // we can check if the current user is in the players list and if their userId matches hostUserId.
  // But we don't know our own userId here easily.
  // However, `startGame` validates on the backend.
  // We can just show the button if we *think* we are the host, or just show it to everyone but it will fail for non-hosts.
  // Better: The `useUser` hook gives us `clerkUser` or `guestId`.
  // We can't easily map that to `userId` without a query.
  // Let's assume for MVP we can just check if we are the first player? No.
  // Let's add a simple check: if the current user created the room, they should be the host.
  // But we don't have that state persisted client side easily.
  // Let's just show the button. If it fails, it fails.
  // OR, we can query `users.ensureUser` to get our ID, but that's a mutation.
  // Let's just show "Waiting for host to start..." for everyone, and "Start Game" for everyone?
  // No, that's bad UX.
  // Let's try to find ourselves in the player list by displayName? No, not unique.
  // Let's just rely on the fact that the host probably joined first?
  // Actually, we can use `useQuery(api.users.getMe)` if we had it.
  // Let's just show the button. It's an MVP.

  const handleStart = async () => {
    try {
      await startGame({ code: room.code, guestId: guestId || undefined });
    } catch (error) {
      console.error('Failed to start game:', error);
      alert('Only the host can start the game!');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">Room: {room.code}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <h3 className="font-medium text-gray-900">
              Players ({players.length})
            </h3>
            <ul className="space-y-1">
              {players.map((player) => (
                <li
                  key={player._id}
                  className="flex items-center justify-between bg-gray-100 px-3 py-2 rounded-md"
                >
                  <span>{player.displayName}</span>
                  {player.userId === room.hostUserId && (
                    <span className="text-xs font-medium text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded-full">
                      Host
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="pt-4">
            <Button
              onClick={handleStart}
              className="w-full"
              size="lg"
              disabled={players.length < 2}
            >
              Start Game
            </Button>
            {players.length < 2 && (
              <p className="text-xs text-center text-gray-500 mt-2">
                Need at least 2 players
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
