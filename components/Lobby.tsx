'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { useUser } from '../lib/auth';
import { errorToFeedback } from '../lib/errorFeedback';
import { Alert } from './ui/Alert';
import { Avatar } from './ui/Avatar';
import { Button } from './ui/Button';
import { HostBadge } from './ui/HostBadge';
import { BotBadge } from './ui/BotBadge';
import { StampAnimation } from './ui/StampAnimation';
import { Doc } from '../convex/_generated/dataModel';
import { Bot, UserMinus } from 'lucide-react';
import { trackGameStarted, trackAiPlayerAdded } from '../lib/analytics';

/**
 * Lobby layout keeps actions separate from the live player list.
 * Room identity and phase status live in RoomChrome above this component.
 */

interface LobbyPlayer extends Doc<'roomPlayers'> {
  stableId: string;
  isBot?: boolean;
  aiPersonaId?: string;
  isAway?: boolean;
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
  const leaveLobbyMutation = useMutation(api.rooms.leaveLobby);
  const closeRoomMutation = useMutation(api.rooms.closeRoom);
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
      trackGameStarted({
        playerCount: players.length,
        hasAi: players.some((p) => p.isBot),
      });
    } catch (err) {
      const feedback = errorToFeedback(err);
      setError(feedback.message);
    }
  };

  const minPlayers = 2;
  const needsMore = minPlayers - players.length;
  const canStart = players.length >= minPlayers;

  // Bots: a host can add up to MAX_BOTS so a single player can fill a room and
  // play solo (backlog 028). Mirrors the MAX_AI_PLAYERS backend default; the
  // server is the source of truth and rejects past the cap.
  const MAX_BOTS = 3;
  const botCount = players.filter((p) => p.isBot).length;
  const canAddAi = isHost && botCount < MAX_BOTS && players.length < 8;

  const handleAddAi = async () => {
    if (!room || aiLoading) return;
    setError(null);
    setAiLoading(true);
    try {
      await addAiMutation({
        code: room.code,
        guestToken: guestToken || undefined,
      });
      trackAiPlayerAdded({ playerCount: players.length + 1 });
    } catch (err) {
      const feedback = errorToFeedback(err);
      setError(feedback.message);
    } finally {
      setAiLoading(false);
    }
  };

  const handleRemoveAi = async (aiUserId: LobbyPlayer['userId']) => {
    if (!room || aiLoading) return;
    setError(null);
    setAiLoading(true);
    try {
      await removeAiMutation({
        code: room.code,
        guestToken: guestToken || undefined,
        aiUserId,
      });
    } catch (err) {
      const feedback = errorToFeedback(err);
      setError(feedback.message);
    } finally {
      setAiLoading(false);
    }
  };

  const handleLeaveLobby = async () => {
    setError(null);
    try {
      await leaveLobbyMutation({
        roomCode: room.code,
        guestToken: guestToken || undefined,
      });
      router.push('/');
    } catch (err) {
      const feedback = errorToFeedback(err);
      setError(feedback.message);
    }
  };

  const handleCloseRoom = async () => {
    setError(null);
    try {
      await closeRoomMutation({
        roomCode: room.code,
        guestToken: guestToken || undefined,
      });
      router.push('/');
    } catch (err) {
      const feedback = errorToFeedback(err);
      setError(feedback.message);
    }
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
              : `Need ${needsMore} more player${needsMore === 1 ? '' : 's'}`}
          </Button>
          <Button
            onClick={handleCloseRoom}
            size="md"
            className="w-full"
            variant="ghost"
          >
            Close room
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
          Waiting for host
        </Button>
        <Button
          onClick={handleLeaveLobby}
          size="md"
          className="w-full"
          variant="ghost"
        >
          Leave room
        </Button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background p-6 md:p-12">
      <div className="w-full max-w-6xl mx-auto">
        <div className="grid md:grid-cols-[auto_1fr] gap-12 md:gap-24">
          <div className="flex flex-col items-center md:items-start space-y-8 md:self-start">
            <div className="max-w-md space-y-4 text-center md:text-left">
              <p className="text-xs font-mono uppercase tracking-[0.32em] text-text-muted">
                Room actions
              </p>
              <h2 className="text-2xl md:text-3xl font-[var(--font-display)] leading-tight text-text-primary">
                Start when everyone is here.
              </h2>
              <p className="text-base leading-relaxed text-text-secondary">
                Share the code from the top bar. Add an AI player if needed.
              </p>
            </div>

            {canAddAi && (
              <Button
                onClick={handleAddAi}
                disabled={aiLoading}
                variant="secondary"
                size="md"
                className="w-full"
              >
                <Bot className="w-4 h-4 mr-2" />
                {aiLoading
                  ? 'Adding...'
                  : `Add a bot (${botCount}/${MAX_BOTS})`}
              </Button>
            )}

            <div className="hidden md:block w-full">
              {error && (
                <Alert variant="error" className="mb-4">
                  {error}
                </Alert>
              )}
              {renderButton()}
            </div>
          </div>

          <div className="relative">
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
                      {player.isAway && (
                        <span className="text-xs font-mono uppercase tracking-widest text-text-muted">
                          away
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {player.isBot && (
                        <>
                          <BotBadge />
                          {isHost && (
                            <button
                              onClick={() => handleRemoveAi(player.userId)}
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
