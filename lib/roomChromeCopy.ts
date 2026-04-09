import { WORD_COUNTS } from '@/convex/lib/gameRules';
import { formatRoomCode } from '@/lib/roomCode';

export interface RoomChromeCopy {
  statusLabel: string;
  title: string;
  subtitle: string;
}

interface ChromeAssignment {
  lineIndex: number;
  targetWordCount: number;
}

interface ChromeRoundProgress {
  round: number;
  players: Array<{ submitted: boolean }>;
}

export function buildLobbyChromeCopy({
  code,
  playerCount,
}: {
  code: string;
  playerCount: number;
}): RoomChromeCopy {
  const needsMore = Math.max(0, 2 - playerCount);

  return {
    statusLabel: 'Lobby',
    title: 'Room open',
    subtitle:
      needsMore > 0
        ? `Share ${formatRoomCode(code)} and gather ${needsMore} more poet${needsMore === 1 ? '' : 's'} before the first line.`
        : `${playerCount} poets are here. Start when the room feels ready.`,
  };
}

export function buildInProgressChromeCopy({
  assignment,
  roundProgress,
}: {
  assignment?: ChromeAssignment | null;
  roundProgress?: ChromeRoundProgress | null;
}): RoomChromeCopy {
  const roundIndex = assignment?.lineIndex ?? roundProgress?.round ?? null;
  const roundNumber = roundIndex === null ? null : roundIndex + 1;
  const roundTitle = roundNumber
    ? `Round ${roundNumber} / ${WORD_COUNTS.length}`
    : 'Writing in progress';

  if (assignment) {
    const { targetWordCount } = assignment;

    return {
      statusLabel: 'In Progress',
      title: roundTitle,
      subtitle: `Write exactly ${targetWordCount} word${targetWordCount === 1 ? '' : 's'}. You can only see the line before yours.`,
    };
  }

  if (roundProgress) {
    const submittedCount = roundProgress.players.filter(
      (player) => player.submitted
    ).length;

    return {
      statusLabel: 'In Progress',
      title: roundTitle,
      subtitle: `${submittedCount} of ${roundProgress.players.length} poets are ready. Hold the cadence while the room catches up.`,
    };
  }

  return {
    statusLabel: 'In Progress',
    title: 'Writing in progress',
    subtitle: 'Keep the room steady while the next prompt resolves.',
  };
}

export function buildRevealChromeCopy({
  allRevealed,
}: {
  allRevealed: boolean;
}): RoomChromeCopy {
  return {
    statusLabel: allRevealed ? 'Session Complete' : 'Reading Phase',
    title: allRevealed ? 'The poems are unsealed' : 'Reveal each poem in turn',
    subtitle: allRevealed
      ? 'Return to the lobby, revisit the session, or head to the archive.'
      : 'One reader at a time. Let the room hear the full poem before moving on.',
  };
}
