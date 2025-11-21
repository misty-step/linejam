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
  const { isLoading, guestToken } = useUser();
  const roomState = useQuery(api.rooms.getRoomState, {
    code,
    guestToken: guestToken || undefined,
  });

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

  if (room.status === 'LOBBY') {
    return <Lobby room={room} players={players} isHost={isHost} />;
  }

  if (room.status === 'IN_PROGRESS') {
    return <WritingScreen roomCode={code} />;
  }

  if (room.status === 'COMPLETED') {
    return <RevealPhase roomCode={code} />;
  }

  return null;
}
