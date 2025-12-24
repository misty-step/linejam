import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { useUser } from '../lib/auth';
import { formatRoomCode } from '../lib/roomCode';
import { errorToFeedback } from '../lib/errorFeedback';
import { Alert } from './ui/Alert';
import { Avatar } from './ui/Avatar';
import { Button } from './ui/Button';
import { HostBadge } from './ui/HostBadge';
import { BotBadge } from './ui/BotBadge';
import { StampAnimation } from './ui/StampAnimation';
import { Doc } from '../convex/_generated/dataModel';
import { Bot, UserMinus } from 'lucide-react';

/**
 * Information Architecture: The Split-View Strategy
 *
 * Strategic Design Decision (Ousterhout: Deep Module):
 * This component presents two conceptually distinct zones that reflect
 * the host's mental model during a gathering:
 *
 * 1. "Control Desk" (Static): Room identity + primary action
 *    - Room code (beacon)
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

interface LobbyPlayer extends Doc<'roomPlayers'> {
  stableId: string;
  isBot?: boolean;
  aiPersonaId?: string;
}

interface LobbyProps {
  room: Doc<'rooms'>;
  players: LobbyPlayer[];
  isHost: boolean;
}

export function Lobby({ room, players, isHost }: LobbyProps) {
  const router = useRouter();
  const { guestToken } = useUser();
  const startGameMutation = useMutation(api.game.startGame);
  const addAiMutation = useMutation(api.ai.addAiPlayer);
  const removeAiMutation = useMutation(api.ai.removeAiPlayer);
  const [error, setError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // For unique avatar colors
  const allStableIds = players.map((p) => p.stableId);

  const handleStartGame = async () => {
    if (!room) return;
    setError(null); // Clear error before retry
    try {
      await startGameMutation({
        code: room.code,
        guestToken: guestToken || undefined,
      });
    } catch (err) {
      const feedback = errorToFeedback(err);
      setError(feedback.message);
    }
  };

  const minPlayers = 2;
  const needsMore = minPlayers - players.length;
  const canStart = players.length >= minPlayers;

  // Check if room has an AI player
  const hasAi = players.some((p) => p.isBot);
  const canAddAi = isHost && !hasAi && players.length < 8;

  const handleAddAi = async () => {
    if (!room || aiLoading) return;
    setError(null);
    setAiLoading(true);
    try {
      await addAiMutation({
        code: room.code,
        guestToken: guestToken || undefined,
      });
    } catch (err) {
      const feedback = errorToFeedback(err);
      setError(feedback.message);
    } finally {
      setAiLoading(false);
    }
  };

  const handleRemoveAi = async () => {
    if (!room || aiLoading) return;
    setError(null);
    setAiLoading(true);
    try {
      await removeAiMutation({
        code: room.code,
        guestToken: guestToken || undefined,
      });
    } catch (err) {
      const feedback = errorToFeedback(err);
      setError(feedback.message);
    } finally {
      setAiLoading(false);
    }
  };

  const handleLeaveLobby = () => {
    router.push('/');
  };

  // Extract button rendering logic (DRY principle for strategic duplication)
  const renderButton = (className?: string) => {
    if (isHost) {
      return (
        <div className="space-y-3">
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
          <Button
            onClick={handleLeaveLobby}
            size="md"
            className="w-full"
            variant="ghost"
          >
            Leave Lobby
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <Button
          disabled
          size="lg"
          className={`w-full h-16 text-lg opacity-50 cursor-not-allowed ${className || ''}`}
          variant="secondary"
        >
          Waiting for Host...
        </Button>
        <Button
          onClick={handleLeaveLobby}
          size="md"
          className="w-full"
          variant="ghost"
        >
          Leave Lobby
        </Button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background p-6 md:p-12">
      <div className="w-full max-w-6xl mx-auto">
        {/* Split-View Grid: Control Desk (left/sticky) + Guest Registry (right/scroll) */}
        <div className="grid md:grid-cols-[auto_1fr] gap-12 md:gap-24">
          {/* CONTROL DESK: Room Identity + Primary Action */}
          <div className="flex flex-col items-center md:items-start space-y-8 md:sticky md:top-12 md:self-start">
            {/* Room Code - Breathing Beacon */}
            <div className="text-center md:text-left">
              <h1 className="text-7xl md:text-9xl font-[var(--font-display)] text-primary tracking-tighter animate-breathe">
                {formatRoomCode(room.code)}
              </h1>
            </div>

            {/* Add AI Player Button - Host only */}
            {canAddAi && (
              <Button
                onClick={handleAddAi}
                disabled={aiLoading}
                variant="secondary"
                size="md"
                className="w-full"
              >
                <Bot className="w-4 h-4 mr-2" />
                {aiLoading ? 'Adding...' : 'Add AI Poet'}
              </Button>
            )}

            {/* Desktop: Inline Button (visible above fold) */}
            <div className="hidden md:block w-full">
              {error && (
                <Alert variant="error" className="mb-4">
                  {error}
                </Alert>
              )}
              {renderButton()}
            </div>
          </div>

          {/* GUEST REGISTRY: Dynamic Arrival Tracking */}
          <div className="relative">
            {/* Player List - Scrollable */}
            <ul className="space-y-6 pb-24 md:pb-0">
              {players.map((player, i) => (
                <StampAnimation key={player._id} delay={i * 150}>
                  <li className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2">
                      <Avatar
                        stableId={player.stableId}
                        displayName={player.displayName}
                        allStableIds={allStableIds}
                        size="md"
                      />
                      <span className="text-2xl md:text-3xl font-medium text-text-primary">
                        {player.displayName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {player.isBot && (
                        <>
                          <BotBadge />
                          {isHost && (
                            <button
                              onClick={handleRemoveAi}
                              disabled={aiLoading}
                              className="p-1.5 text-text-muted hover:text-primary transition-colors disabled:opacity-50"
                              aria-label="Remove AI player"
                            >
                              <UserMinus className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      )}
                      {player.userId === room.hostUserId && <HostBadge />}
                    </div>
                  </li>
                </StampAnimation>
              ))}
            </ul>

            {/* Mobile: Sticky Footer (native pattern) */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 p-6 bg-background/95 backdrop-blur-md border-t-2 border-primary/20 shadow-[0_-8px_32px_rgba(0,0,0,0.1)] dark:shadow-[0_-8px_32px_rgba(0,0,0,0.4)]">
              {error && (
                <Alert variant="error" className="mb-4">
                  {error}
                </Alert>
              )}
              {renderButton()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
