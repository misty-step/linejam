import { useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { useUser } from '../lib/auth';
import { formatRoomCode } from '../lib/roomCode';
import { Button } from './ui/Button';
import { Stamp } from './ui/Stamp';
import { StampAnimation } from './ui/StampAnimation';
import { Doc } from '../convex/_generated/dataModel';
import { RoomQr } from './RoomQr';

/**
 * Information Architecture: The Split-View Strategy
 *
 * Strategic Design Decision (Ousterhout: Deep Module):
 * This component presents two conceptually distinct zones that reflect
 * the host's mental model during a gathering:
 *
 * 1. "Control Desk" (Static): Room identity + primary action
 *    - Room code (beacon)
 *    - QR code (invitation)
 *    - Start button (action)
 *
 * 2. "Guest Registry" (Dynamic): Arrival tracking
 *    - Player list (grows)
 *    - Stamps mark arrivals
 *
 * Why this structure?
 * - Problem: Vertical stacking pushed critical action below fold
 * - Tactical fix: Add sticky positioning
 * - Strategic fix: Restructure information architecture
 *
 * Implementation:
 * - Desktop: Two-column grid (control desk sticky left, registry scrolls right)
 * - Mobile: Single column + sticky footer (native iOS/Android pattern)
 * - Button rendered twice (desktop inline, mobile sticky) - complexity hidden from parent
 *
 * This is a deep module: Simple interface (props), complex responsive layout inside.
 */

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

  const minPlayers = 2;
  const needsMore = minPlayers - players.length;
  const canStart = players.length >= minPlayers;

  // Extract button rendering logic (DRY principle for strategic duplication)
  const renderButton = (className?: string) => {
    if (isHost) {
      return (
        <Button
          onClick={handleStartGame}
          size="lg"
          className={`w-full h-16 text-lg ${className || ''}`}
          disabled={!canStart}
          variant={canStart ? 'primary' : 'secondary'}
        >
          {canStart
            ? 'Start Linejam'
            : `Need ${needsMore} more Poet${needsMore !== 1 ? 's' : ''} to Jam`}
        </Button>
      );
    }

    return (
      <Button
        disabled
        size="lg"
        className={`w-full h-16 text-lg opacity-50 cursor-not-allowed ${className || ''}`}
        variant="secondary"
      >
        Waiting for Host...
      </Button>
    );
  };

  return (
    <div className="min-h-screen bg-[var(--color-background)] p-6 md:p-12">
      <div className="w-full max-w-6xl mx-auto">
        {/* Split-View Grid: Control Desk (left/sticky) + Guest Registry (right/scroll) */}
        <div className="grid md:grid-cols-[auto_1fr] gap-12 md:gap-24">
          {/* CONTROL DESK: Room Identity + Primary Action */}
          <div className="flex flex-col items-center md:items-start space-y-8 md:sticky md:top-12 md:self-start">
            {/* Room Code - Breathing Beacon */}
            <div className="text-center md:text-left">
              <h1 className="text-7xl md:text-9xl font-[var(--font-display)] text-[var(--color-primary)] tracking-tighter animate-breathe">
                {formatRoomCode(room.code)}
              </h1>
            </div>

            {/* QR Code Invitation */}
            {isHost && <RoomQr roomCode={room.code} />}

            {/* Desktop: Inline Button (visible above fold) */}
            <div className="hidden md:block w-full">{renderButton()}</div>
          </div>

          {/* GUEST REGISTRY: Dynamic Arrival Tracking */}
          <div className="relative">
            {/* Player List - Scrollable */}
            <ul className="space-y-6 pb-24 md:pb-0">
              {players.map((player, i) => (
                <StampAnimation key={player._id} delay={i * 150}>
                  <li className="flex items-center justify-between py-2">
                    <span className="text-2xl md:text-3xl font-medium text-[var(--color-text-primary)]">
                      {player.displayName}
                    </span>
                    {player.userId === room.hostUserId && (
                      <Stamp type="hanko" size="sm" />
                    )}
                  </li>
                </StampAnimation>
              ))}
            </ul>

            {/* Mobile: Sticky Footer (native pattern) */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 p-6 bg-[var(--color-background)]/95 backdrop-blur-md border-t-2 border-[var(--color-primary)]/20 shadow-[0_-8px_32px_rgba(0,0,0,0.1)] dark:shadow-[0_-8px_32px_rgba(0,0,0,0.4)]">
              {renderButton()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
