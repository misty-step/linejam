'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { useUser } from '../lib/auth';
import { E2E_TEST_IDS } from '../lib/e2eTestIds';
import { errorToFeedback } from '../lib/errorFeedback';
import { formatRoomCode } from '../lib/roomCode';
import { Alert } from './ui/Alert';
import { Avatar } from './ui/Avatar';
import { Button } from './ui/Button';
import { HostBadge } from './ui/HostBadge';
import { BotBadge } from './ui/BotBadge';
import { LobbyJoinQr, LobbyStage } from './stage/LobbyStage';
import { StampAnimation } from './ui/StampAnimation';
import { Doc } from '../convex/_generated/dataModel';
import { Bot, Presentation, UserMinus } from 'lucide-react';
import {
  hashRoomId,
  trackGameStarted,
  trackLobbyReady,
} from '../lib/analytics';

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
  const [isPresenting, setIsPresenting] = useState(false);

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
      // The mutation is authoritative and increments the cycle for rematches.
      // Emit both transition stages only after it succeeds, so retries/failures
      // cannot report a lobby as ready or use the previous cycle number.
      const cycle = (room.currentCycle ?? 0) + 1;
      const analyticsProps = {
        roomIdHash: hashRoomId(room._id),
        cycle,
        playerKind: 'human' as const,
      };
      trackLobbyReady(analyticsProps);
      trackGameStarted(analyticsProps);
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
      // AI seats are represented by playerKind on the canonical room event;
      // no separate conversion event is emitted.
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
            data-testid={E2E_TEST_IDS.lobbyStartGameButton}
            size="lg"
            className={`h-auto min-h-[64px] w-full min-w-0 px-[16px] py-[12px] text-[clamp(1rem,5vw,1.125rem)] md:min-h-16 md:px-8 md:text-lg ${className || ''}`}
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
            className="w-full min-w-0 px-[16px] text-[clamp(0.875rem,4.5vw,1rem)] md:px-6 md:text-base"
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
          data-testid={E2E_TEST_IDS.lobbyWaitingForHostButton}
          size="lg"
          className={`h-auto min-h-[64px] w-full min-w-0 px-[16px] py-[12px] text-[clamp(1rem,5vw,1.125rem)] opacity-50 cursor-not-allowed md:min-h-16 md:px-8 md:text-lg ${className || ''}`}
          variant="secondary"
        >
          Waiting for host
        </Button>
        <Button
          onClick={handleLeaveLobby}
          size="md"
          className="w-full min-w-0 px-[16px] text-[clamp(0.875rem,4.5vw,1rem)] md:px-6 md:text-base"
          variant="ghost"
        >
          Leave room
        </Button>
      </div>
    );
  };

  return (
    <>
      {isPresenting && (
        <LobbyStage
          room={room}
          players={players}
          onExit={() => setIsPresenting(false)}
        />
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
        <div
          data-testid={E2E_TEST_IDS.lobbyScrollRegion}
          className="lj-safe-frame min-h-0 flex-1 overflow-y-auto overflow-x-hidden md:[--lj-safe-frame-space:3rem]"
        >
          <div className="mx-auto w-full max-w-6xl space-y-10 md:space-y-16">
            {/* Room code hero — legible across the table, the party's rallying point */}
            <div className="text-center space-y-2">
              <p className="max-w-full break-words text-xs font-mono uppercase tracking-[0.16em] text-text-muted sm:tracking-[0.32em]">
                Share this code
              </p>
              <p className="font-[var(--font-display)] text-[clamp(2rem,16vw,3rem)] sm:text-6xl md:text-7xl font-medium tracking-[0.08em] text-text-primary">
                {formatRoomCode(room.code)}
              </p>
            </div>

            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-12 md:grid-cols-[auto_minmax(0,1fr)] md:gap-24">
              <div className="flex min-w-0 max-w-full flex-col items-center space-y-4 md:items-start md:self-start">
                <LobbyJoinQr room={room} />
                {canAddAi && (
                  <Button
                    onClick={handleAddAi}
                    disabled={aiLoading}
                    variant="secondary"
                    size="md"
                    className="h-auto min-h-[44px] w-full min-w-0 max-w-full px-[16px] py-[10px] text-[clamp(0.875rem,4.5vw,1rem)] md:min-h-11 md:px-6 md:text-base"
                  >
                    <Bot className="mr-[8px] h-4 w-4" />
                    {aiLoading
                      ? 'Adding...'
                      : `Add a bot (${botCount}/${MAX_BOTS})`}
                  </Button>
                )}

                {isHost && (
                  <Button
                    type="button"
                    onClick={() => setIsPresenting(true)}
                    data-testid={E2E_TEST_IDS.lobbyPresentationButton}
                    variant="outline"
                    size="md"
                    className="h-auto min-h-[44px] w-full min-w-0 max-w-full px-[16px] py-[10px] text-[clamp(0.875rem,4.5vw,1rem)] md:min-h-11 md:px-6 md:text-base"
                  >
                    <Presentation className="mr-[8px] h-4 w-4" />
                    Present room
                  </Button>
                )}
              </div>

              <div className="relative order-first min-w-0 max-w-full md:order-none">
                <ul className="min-w-0 max-w-full space-y-6 pb-8 md:pb-0">
                  {players.map((player, i) => (
                    <StampAnimation
                      key={player._id}
                      delay={i * 150}
                      className="mx-[12px] min-w-0 max-w-full sm:mx-0"
                    >
                      <li className="grid min-w-0 max-w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-2">
                        <div className="flex min-w-0 max-w-full flex-1 items-center gap-2">
                          <Avatar
                            stableId={player.stableId}
                            displayName={player.displayName}
                            allStableIds={allStableIds}
                            size="md"
                          />
                          <span className="min-w-0 flex-1 truncate text-2xl font-medium text-text-primary md:text-3xl">
                            {player.displayName}
                          </span>
                          {player.isAway && (
                            <span className="shrink-0 text-xs font-mono uppercase tracking-widest text-text-muted">
                              away
                            </span>
                          )}
                        </div>
                        <div className="flex max-w-full flex-wrap items-center justify-self-end gap-2">
                          {player.isBot && (
                            <>
                              <BotBadge />
                              {isHost && (
                                <button
                                  onClick={() => handleRemoveAi(player.userId)}
                                  disabled={aiLoading}
                                  className="flex h-11 w-11 items-center justify-center rounded-md text-text-muted transition-colors hover:text-primary disabled:opacity-50"
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
              </div>
            </div>
          </div>
        </div>

        <div
          data-testid={E2E_TEST_IDS.lobbyActionZone}
          className="lj-safe-inline min-h-0 max-h-[50%] flex-[0_1_auto] overflow-y-auto border-t-2 border-primary/20 bg-background/95 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-lg)] backdrop-blur-md md:[--lj-safe-inline-space:3rem]"
        >
          <div className="mx-auto w-full max-w-sm">
            {error && (
              <Alert variant="error" className="mb-4">
                {error}
              </Alert>
            )}
            {renderButton()}
          </div>
        </div>
      </div>
    </>
  );
}
