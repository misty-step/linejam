'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Doc } from '@/convex/_generated/dataModel';
import { AuthErrorState } from '@/components/AuthErrorState';
import { Lobby } from '@/components/Lobby';
import { RevealPhase } from '@/components/RevealPhase';
import { RoomChrome } from '@/components/RoomChrome';
import { Button } from '@/components/ui/Button';
import { WritingScreen } from '@/components/WritingScreen';
import { LoadingMessages, LoadingState } from '@/components/ui/LoadingState';
import { useUser } from '@/lib/auth';
import { captureError } from '@/lib/error';
import { buildLobbyChromeCopy } from '@/lib/roomChromeCopy';

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
      <>
        <RoomChrome
          roomCode={code}
          {...buildLobbyChromeCopy({
            code,
            playerCount: players.length,
          })}
        />
        <Lobby room={room} players={players} isHost={isHost} />
      </>
    );
  }

  if (room.status === 'IN_PROGRESS') {
    return <WritingScreen roomCode={code} showChrome />;
  }

  if (room.status === 'COMPLETED') {
    return <RevealPhase roomCode={code} showChrome />;
  }

  return <UnexpectedRoomState code={code} status={String(room.status)} />;
}

export default function RoomPage({ params }: RoomPageProps) {
  const { code } = use(params);
  const { isLoading, guestToken, authError, retryAuth } = useUser();
  const roomState = useQuery(api.rooms.getRoomState, {
    code,
    guestToken: guestToken || undefined,
  });

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
