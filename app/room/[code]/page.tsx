'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Doc } from '@/convex/_generated/dataModel';
import { AuthErrorState } from '@/components/AuthErrorState';
import { Lobby } from '@/components/Lobby';
import { RevealPhase } from '@/components/RevealPhase';
import { RoomPanelErrorBoundary } from '@/components/RoomPanelErrorBoundary';
import { RoomChrome } from '@/components/RoomChrome';
import { Button } from '@/components/ui/Button';
import { WritingScreen } from '@/components/WritingScreen';
import { LoadingMessages, LoadingState } from '@/components/ui/LoadingState';
import { useUser } from '@/lib/auth';
import { captureError } from '@/lib/error';
import { buildLobbyChromeCopy } from '@/lib/roomChromeCopy';
import { usePresence } from '@/hooks/usePresence';

function UnexpectedRoomState({
  code,
  status,
}: {
  code: string;
  status: string;
}) {
  const router = useRouter();

  useEffect(() => {
    captureError(new Error('Unexpected room status'), {
      operation: 'renderRoomPage',
      roomCode: code,
      status,
    });
  }, [code, status]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-background)] gap-4 p-6 text-center">
      <span className="text-[var(--color-text-primary)] text-xl">
        We lost track of this room state
      </span>
      <span className="text-[var(--color-text-muted)] text-sm max-w-xl">
        The room is still there, but this client received a state it does not
        understand yet. Refresh or head home and rejoin the room.
      </span>
      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => router.push('/')}
        >
          Go home
        </Button>
      </div>
    </div>
  );
}

interface RoomPageProps {
  params: Promise<{ code: string }>;
}

interface RoomPageState {
  room: Doc<'rooms'> & { status: Doc<'rooms'>['status'] };
  players: Array<
    Doc<'roomPlayers'> & {
      stableId: string;
      isBot?: boolean;
      aiPersonaId?: string;
    }
  >;
  isHost: boolean;
}

function ResolvedRoomPage({
  code,
  roomState,
}: {
  code: string;
  roomState: RoomPageState;
}) {
  const { room, players, isHost } = roomState;

  if (room.status === 'LOBBY') {
    return (
      <RoomPanelErrorBoundary
        key={`${code}:lobby`}
        roomCode={code}
        panel="lobby"
      >
        <RoomChrome
          roomCode={code}
          {...buildLobbyChromeCopy({
            code,
            playerCount: players.length,
          })}
        />
        <Lobby room={room} players={players} isHost={isHost} />
      </RoomPanelErrorBoundary>
    );
  }

  if (room.status === 'IN_PROGRESS') {
    return (
      <RoomPanelErrorBoundary
        key={`${code}:writing`}
        roomCode={code}
        panel="writing"
      >
        <WritingScreen roomCode={code} showChrome />
      </RoomPanelErrorBoundary>
    );
  }

  if (room.status === 'COMPLETED') {
    return (
      <RoomPanelErrorBoundary
        key={`${code}:reveal`}
        roomCode={code}
        panel="reveal"
      >
        <RevealPhase roomCode={code} showChrome />
      </RoomPanelErrorBoundary>
    );
  }

  return <UnexpectedRoomState code={code} status={String(room.status)} />;
}

function RoomPageContent({ code }: { code: string }) {
  const { isLoading, guestToken, authError, retryAuth } = useUser();
  const roomState = useQuery(api.rooms.getRoomState, {
    code,
    guestToken: guestToken || undefined,
  });

  // Heartbeat presence while the room page is mounted (lobby, writing, reveal).
  usePresence(code, guestToken);

  if (authError) {
    return <AuthErrorState message={authError} onRetry={retryAuth} />;
  }

  if (isLoading || roomState === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)]">
        <LoadingState message={LoadingMessages.LOADING_ROOM} />
      </div>
    );
  }

  if (roomState === null) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-background)] gap-4">
        <span className="text-[var(--color-text-primary)] text-xl">
          Room not found
        </span>
        <span className="text-[var(--color-text-muted)] text-sm">
          The room code may be incorrect or the room has expired.
        </span>
      </div>
    );
  }

  return <ResolvedRoomPage code={code} roomState={roomState} />;
}

export default function RoomPage({ params }: RoomPageProps) {
  const { code } = use(params);

  return (
    <RoomPanelErrorBoundary roomCode={code} panel="room">
      <RoomPageContent code={code} />
    </RoomPanelErrorBoundary>
  );
}
