'use client';

import { use, useState } from 'react';
import { useQuery } from 'convex/react';
import { HelpCircle } from 'lucide-react';
import { api } from '../../../convex/_generated/api';
import { Lobby } from '../../../components/Lobby';
import { WritingScreen } from '../../../components/WritingScreen';
import { RevealPhase } from '../../../components/RevealPhase';
import { HelpModal } from '../../../components/HelpModal';
import { useUser } from '../../../lib/auth';

interface RoomPageProps {
  params: Promise<{ code: string }>;
}

export default function RoomPage({ params }: RoomPageProps) {
  const { code } = use(params);
  const { isLoading, guestToken } = useUser();
  const [showHelp, setShowHelp] = useState(false);
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

  // Determine which screen to show
  let content = null;
  if (room.status === 'LOBBY') {
    content = <Lobby room={room} players={players} isHost={isHost} />;
  } else if (room.status === 'IN_PROGRESS') {
    content = <WritingScreen roomCode={code} />;
  } else if (room.status === 'COMPLETED') {
    content = <RevealPhase roomCode={code} />;
  }

  return (
    <>
      {/* Floating help button */}
      <button
        onClick={() => setShowHelp(true)}
        className="fixed top-4 right-4 z-40 w-10 h-10 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/80 backdrop-blur-sm flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)] transition-colors duration-[var(--duration-fast)]"
        aria-label="How to play"
      >
        <HelpCircle className="w-5 h-5" />
      </button>

      <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />

      {content}
    </>
  );
}
