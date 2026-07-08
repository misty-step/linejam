'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { Doc } from '@/convex/_generated/dataModel';
import { E2E_TEST_IDS } from '@/lib/e2eTestIds';
import { formatRoomCode } from '@/lib/roomCode';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/Avatar';
import { HostBadge } from '@/components/ui/HostBadge';
import { BotBadge } from '@/components/ui/BotBadge';
import { StageShell } from './StageShell';

interface LobbyStagePlayer extends Doc<'roomPlayers'> {
  stableId: string;
  isBot?: boolean;
  isAway?: boolean;
}

interface LobbyStageProps {
  room: Doc<'rooms'>;
  players: LobbyStagePlayer[];
  onExit: () => void;
}

export function LobbyStage({ room, players, onExit }: LobbyStageProps) {
  const [recentlyJoinedIds, setRecentlyJoinedIds] = useState<string[]>([]);
  const timeoutIds = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const previousPlayerIds = useRef(
    new Set(players.map((player) => String(player._id)))
  );
  const allStableIds = useMemo(
    () => players.map((player) => player.stableId),
    [players]
  );
  const formattedCode = formatRoomCode(room.code);
  const joinUrl =
    typeof window === 'undefined'
      ? `/join?code=${room.code}`
      : `${window.location.origin}/join?code=${room.code}`;

  useEffect(() => {
    const currentIds = new Set(players.map((player) => String(player._id)));
    const joinedIds = players
      .map((player) => String(player._id))
      .filter((id) => !previousPlayerIds.current.has(id));

    if (joinedIds.length > 0) {
      setRecentlyJoinedIds((current) =>
        Array.from(new Set([...current, ...joinedIds]))
      );

      const timeoutId = setTimeout(() => {
        setRecentlyJoinedIds((current) =>
          current.filter((id) => !joinedIds.includes(id))
        );
      }, 1600);
      timeoutIds.current.push(timeoutId);
    }

    previousPlayerIds.current = currentIds;
  }, [players]);

  useEffect(() => {
    const timeouts = timeoutIds.current;
    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, []);

  return (
    <StageShell
      testId={E2E_TEST_IDS.lobbyPresentationStage}
      title="Join from any phone"
      subtitle="Scan the code, then look up when the poems begin."
      onExit={onExit}
    >
      <div className="grid min-h-[calc(100vh-14rem)] gap-10 xl:grid-cols-[minmax(360px,0.85fr)_minmax(0,1fr)] xl:items-center">
        <section className="flex flex-col items-center justify-center gap-8 text-center">
          <div className="rounded-[2rem] border border-border bg-surface p-5 shadow-[var(--shadow-lg)]">
            <QRCodeSVG
              value={joinUrl}
              size={420}
              level="M"
              fgColor="var(--color-text-primary)"
              bgColor="var(--color-surface)"
              role="img"
              aria-label={`QR code for joining room ${formattedCode}`}
              className="h-[min(44vh,420px)] w-[min(44vh,420px)]"
            />
          </div>
          <p className="font-mono text-[clamp(4.5rem,12vw,11rem)] font-semibold leading-none tracking-[0.16em] text-text-primary">
            {formattedCode}
          </p>
        </section>

        <section className="flex flex-col justify-center">
          <div className="mb-8 flex items-end justify-between gap-4 border-b border-border-subtle pb-5">
            <div>
              <p className="text-xs font-mono uppercase tracking-[0.28em] text-text-muted">
                Live roster
              </p>
              <p className="mt-2 text-4xl font-[var(--font-display)] leading-none md:text-6xl">
                {players.length} in the room
              </p>
            </div>
          </div>

          <ul className="grid gap-3">
            {players.map((player) => {
              const isRecent = recentlyJoinedIds.includes(String(player._id));

              return (
                <li
                  key={player._id}
                  className={cn(
                    'flex min-w-0 items-center justify-between gap-5 border-b border-border-subtle py-4 transition-colors',
                    isRecent && 'bg-primary/5'
                  )}
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <Avatar
                      stableId={player.stableId}
                      displayName={player.displayName}
                      allStableIds={allStableIds}
                      size="xl"
                    />
                    <span className="min-w-0 truncate text-[clamp(2rem,5vw,5rem)] font-medium leading-none text-text-primary">
                      {player.displayName}
                    </span>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    {isRecent && (
                      <span className="rounded-full border border-primary px-3 py-1.5 text-xs font-mono uppercase tracking-[0.18em] text-primary">
                        Just joined
                      </span>
                    )}
                    {player.isAway && (
                      <span className="rounded-full border border-border px-3 py-1.5 text-xs font-mono uppercase tracking-[0.18em] text-text-muted">
                        Away
                      </span>
                    )}
                    {player.isBot && <BotBadge />}
                    {player.userId === room.hostUserId && <HostBadge />}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </StageShell>
  );
}
