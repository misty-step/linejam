'use client';

import { use } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Lobby } from '../../../components/Lobby';
import { WritingScreen } from '../../../components/WritingScreen';
import { RevealPhase } from '../../../components/RevealPhase';
import { useUser } from '../../../lib/auth';

interface RoomPageProps {
  params: Promise<{ code: string }>;
}

export default function RoomPage({ params }: RoomPageProps) {
  const { code } = use(params);
  const { isLoading, guestToken, authError, retryAuth } = useUser();
  const roomState = useQuery(api.rooms.getRoomState, {
    code,
    guestToken: guestToken || undefined,
  });

  if (authError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-background)] gap-4">
        <span className="text-[var(--color-text-primary)] text-xl">
          Connection error
        </span>
        <span className="text-[var(--color-text-muted)] text-sm">
          {authError}
        </span>
        <button
          onClick={retryAuth}
          className="px-4 py-2 bg-[var(--color-accent)] text-white rounded hover:opacity-90 transition-opacity"
        >
          Try again
        </button>
      </div>
    );
  }

  if (isLoading || roomState === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)]">
        <span className="text-[var(--color-text-muted)]">Loading...</span>
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

  const { room, players, isHost } = roomState;

  // Determine which screen to show
  let content = null;
  if (room.status === 'LOBBY') {
    content = <Lobby room={room} players={players} isHost={isHost} />;
  } else if (room.status === 'IN_PROGRESS') {
    content = <WritingScreen roomCode={code} />;
  } else if (room.status === 'COMPLETED') {
    content = <RevealPhase roomCode={code} />;
  }

  return content;
}
