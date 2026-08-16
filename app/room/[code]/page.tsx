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
import { ConnectionStatus } from '@/components/ConnectionStatus';

interface RoomPageRouter {
  push(href: string): void;
}

interface RoomPageUserState {
  isLoading: boolean;
  guestToken: string | null;
  authError: string | null;
  retryAuth(): void;
}

function useDefaultRoomUser(): RoomPageUserState {
  const { isLoading, guestToken, authError, retryAuth } = useUser();
  return { isLoading, guestToken, authError, retryAuth };
}

function useDefaultRoomState(code: string, guestToken: string | null) {
  return useQuery(api.rooms.getRoomState, {
    code,
    guestToken: guestToken || undefined,
  });
}

export interface RoomPageDependencies {
  useRouter(): RoomPageRouter;
  useUser(): RoomPageUserState;
  useRoomState: typeof useDefaultRoomState;
  usePresence: typeof usePresence;
  captureError: typeof captureError;
  LobbyComponent: typeof Lobby;
  WritingScreenComponent: typeof WritingScreen;
  RevealPhaseComponent: typeof RevealPhase;
  ConnectionStatusComponent: typeof ConnectionStatus;
}

const defaultRoomPageDependencies: RoomPageDependencies = {
  useRouter,
  useUser: useDefaultRoomUser,
  useRoomState: useDefaultRoomState,
  usePresence,
  captureError,
  LobbyComponent: Lobby,
  WritingScreenComponent: WritingScreen,
  RevealPhaseComponent: RevealPhase,
  ConnectionStatusComponent: ConnectionStatus,
};

function UnexpectedRoomState({
  code,
  status,
  dependencies,
}: {
  code: string;
  status: string;
  dependencies: RoomPageDependencies;
}) {
  const router = dependencies.useRouter();

  useEffect(() => {
    dependencies.captureError(new Error('Unexpected room status'), {
      operation: 'renderRoomPage',
      roomCode: code,
      status,
    });
  }, [code, dependencies, status]);

  return (
    <div className="lj-game-viewport flex flex-col items-center justify-center gap-4 bg-[var(--color-background)] p-6 text-center">
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

interface RoomPageRouteProps {
  params: Promise<{ code: string }>;
}

interface RoomPageProps {
  code: string;
  dependencies?: RoomPageDependencies;
}

interface RoomPageState {
  room: Doc<'rooms'> & { status: Doc<'rooms'>['status'] };
  players: Array<Doc<'roomPlayers'> & { stableId: string }>;
  isHost: boolean;
}

function ResolvedRoomPage({
  code,
  roomState,
  dependencies,
}: {
  code: string;
  roomState: RoomPageState;
  dependencies: RoomPageDependencies;
}) {
  const { LobbyComponent, WritingScreenComponent, RevealPhaseComponent } =
    dependencies;
  const { room, players, isHost } = roomState;

  if (room.status === 'LOBBY') {
    return (
      <RoomPanelErrorBoundary
        key={`${code}:lobby`}
        roomCode={code}
        panel="lobby"
      >
        <div className="lj-game-frame lj-viewport-offset relative flex min-h-0 flex-col bg-background">
          <RoomChrome
            roomCode={code}
            statusBoard
            {...buildLobbyChromeCopy({
              code,
              playerCount: players.length,
            })}
          />
          <LobbyComponent room={room} players={players} isHost={isHost} />
        </div>
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
        <WritingScreenComponent roomCode={code} showChrome />
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
        <RevealPhaseComponent roomCode={code} showChrome />
      </RoomPanelErrorBoundary>
    );
  }

  return (
    <UnexpectedRoomState
      code={code}
      status={String(room.status)}
      dependencies={dependencies}
    />
  );
}

function RoomPageContent({
  code,
  dependencies,
}: {
  code: string;
  dependencies: RoomPageDependencies;
}) {
  const router = dependencies.useRouter();
  const { isLoading, guestToken, authError, retryAuth } =
    dependencies.useUser();
  const roomState = dependencies.useRoomState(code, guestToken);

  // Heartbeat presence while the room page is mounted (lobby, writing, reveal).
  dependencies.usePresence(code, guestToken);
  if (authError) {
    return <AuthErrorState message={authError} onRetry={retryAuth} />;
  }

  if (isLoading || roomState === undefined) {
    return (
      <div className="lj-game-viewport flex items-center justify-center bg-[var(--color-background)]">
        <LoadingState message={LoadingMessages.LOADING_ROOM} />
      </div>
    );
  }

  if (roomState === null) {
    return (
      <div className="lj-game-viewport lj-safe-inline flex flex-col items-center justify-center gap-4 bg-[var(--color-background)] px-4 py-6 text-center">
        <span className="break-words text-[var(--color-text-primary)] text-xl">
          Room not found
        </span>
        <span className="max-w-md break-words text-[var(--color-text-muted)] text-sm [overflow-wrap:anywhere]">
          This room code is incorrect or the room has expired.
        </span>
        <button
          type="button"
          className="min-h-11 w-full max-w-xs rounded-md border border-transparent bg-[var(--color-surface)] px-4 py-2 font-medium text-[var(--color-text-primary)] shadow-sm"
          onClick={() => router.push('/join')}
        >
          Return to join
        </button>
      </div>
    );
  }

  const ConnectionStatusComponent = dependencies.ConnectionStatusComponent;
  return (
    <>
      <ConnectionStatusComponent />
      <ResolvedRoomPage
        code={code}
        roomState={roomState}
        dependencies={dependencies}
      />
    </>
  );
}

export function RoomPage({
  code,
  dependencies = defaultRoomPageDependencies,
}: RoomPageProps) {
  return (
    <RoomPanelErrorBoundary roomCode={code} panel="room">
      <RoomPageContent code={code} dependencies={dependencies} />
    </RoomPanelErrorBoundary>
  );
}

export default function RoomRoutePage({ params }: RoomPageRouteProps) {
  const { code } = use(params);
  return <RoomPage code={code} />;
}
