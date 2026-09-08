'use client';

import { QRCodeSVG } from 'qrcode.react';
import type { Doc } from '@/convex/_generated/dataModel';
import { E2E_TEST_IDS } from '@/lib/e2eTestIds';
import { formatRoomCode } from '@/lib/roomCode';
import { Avatar } from '@/components/ui/Avatar';
import { HostBadge } from '@/components/ui/HostBadge';
import { StageShell } from './StageShell';

interface LobbyStagePlayer extends Doc<'roomPlayers'> {
  stableId: string;
  isAway?: boolean;
}

function buildJoinUrl(roomCode: string): string {
  return globalThis.window === undefined
    ? `/join?code=${roomCode}`
    : `${globalThis.window.location.origin}/join?code=${roomCode}`;
}

interface LobbyStageProps {
  room: Doc<'rooms'>;
  players: LobbyStagePlayer[];
  onExit: () => void;
}

export function LobbyJoinQr({ room }: { room: Doc<'rooms'> }) {
  const joinUrl = buildJoinUrl(room.code);

  return (
    <div
      className="flex min-w-0 flex-col items-center gap-3"
      data-testid="lobby-join-qr"
    >
      <QRCodeSVG
        value={joinUrl}
        size={180}
        level="M"
        fgColor="var(--color-text-primary)"
        bgColor="var(--color-surface)"
        role="img"
        aria-label={`QR code for joining room ${formatRoomCode(room.code)}`}
        className="block h-auto w-full max-w-[180px] rounded-lg border border-border bg-surface p-2"
      />
      <a
        href={joinUrl}
        className="flex min-h-[44px] items-center text-center text-base font-semibold text-primary underline underline-offset-4"
      >
        Open join link
      </a>
    </div>
  );
}

export function LobbyStage({ room, players, onExit }: LobbyStageProps) {
  const allStableIds = players.map((player) => player.stableId);
  const formattedCode = formatRoomCode(room.code);
  const joinUrl = buildJoinUrl(room.code);

  return (
    <StageShell
      testId={E2E_TEST_IDS.lobbyPresentationStage}
      title="Join the room"
      onExit={onExit}
    >
      <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)] lg:items-start xl:gap-16">
        <section
          aria-label="Join this room"
          className="flex min-w-0 flex-col items-center gap-5 text-center"
        >
          <div className="min-w-0 max-w-full">
            <p className="mb-1 text-lg text-text-secondary">Room code</p>
            <p className="break-words text-5xl font-bold leading-tight tracking-wide text-text-primary sm:text-6xl xl:text-7xl">
              {formattedCode}
            </p>
          </div>
          <div className="w-full max-w-[min(22rem,34vh)] rounded-[var(--radius-lg)] border border-border bg-surface p-4">
            <QRCodeSVG
              value={joinUrl}
              size={420}
              level="M"
              fgColor="var(--color-text-primary)"
              bgColor="var(--color-surface)"
              role="img"
              aria-label={`QR code for joining room ${formattedCode}`}
              className="block h-auto w-full"
            />
          </div>
        </section>

        <section aria-labelledby="stage-roster-heading" className="min-w-0">
          <div className="mb-2 flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border pb-4">
            <h2
              id="stage-roster-heading"
              className="text-2xl font-bold text-text-primary md:text-3xl"
            >
              Players
            </h2>
            <p
              className="text-lg text-text-secondary md:text-xl"
              aria-live="polite"
              aria-atomic="true"
            >
              {players.length} of 8
            </p>
          </div>

          <ul className="min-w-0 divide-y divide-border-subtle">
            {players.map((player) => (
              <li
                key={player._id}
                className="flex min-w-0 items-center gap-4 py-4"
              >
                <Avatar
                  stableId={player.stableId}
                  avatarId={player.avatarId}
                  displayName={player.displayName}
                  allStableIds={allStableIds}
                  size="xl"
                />
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2">
                  <span className="min-w-0 break-words text-2xl font-semibold leading-tight text-text-primary [overflow-wrap:anywhere] md:text-3xl xl:text-4xl">
                    {player.displayName}
                  </span>
                  {player.userId === room.hostUserId && <HostBadge />}
                  {player.isAway && (
                    <span className="text-base text-text-secondary md:text-lg">
                      Away
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </StageShell>
  );
}
