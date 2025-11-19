'use client';

import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useParams } from 'next/navigation';
import { Lobby } from '../../../components/Lobby';
import { WritingScreen } from '../../../components/WritingScreen';
import { RevealList } from '../../../components/RevealList';
import { useUser } from '../../../lib/auth';

export default function RoomPage() {
  const params = useParams();
  const code = params.code as string;
  const roomState = useQuery(api.rooms.getRoomState, { code });
  const { isLoading } = useUser();

  if (isLoading || roomState === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  if (roomState === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Room not found
      </div>
    );
  }

  const { room, players } = roomState;

  if (room.status === 'LOBBY') {
    return <Lobby room={room} players={players} />;
  }

  if (room.status === 'IN_PROGRESS') {
    return <WritingScreen roomCode={code} />;
  }

  if (room.status === 'COMPLETED') {
    return <RevealList roomCode={code} />;
  }

  return null;
}
