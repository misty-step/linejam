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
  totalRounds?: number;
}

interface ChromeRoundProgress {
  round: number;
  totalRounds?: number;
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
    title:
      needsMore > 0
        ? `Need ${needsMore} more player${needsMore === 1 ? '' : 's'}`
        : `${playerCount} players ready`,
    subtitle:
      needsMore > 0
        ? `Share ${formatRoomCode(code)} to start.`
        : 'Start when you are ready.',
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
  const totalRounds =
    assignment?.totalRounds ?? roundProgress?.totalRounds ?? WORD_COUNTS.length;
  const roundTitle = roundNumber
    ? `Round ${roundNumber} of ${totalRounds}`
    : 'Writing';

  if (assignment) {
    const { targetWordCount } = assignment;

    return {
      statusLabel: 'Writing',
      title: roundTitle,
      subtitle: `Write exactly ${targetWordCount} word${targetWordCount === 1 ? '' : 's'}. You only see the previous line.`,
    };
  }

  if (roundProgress) {
    const submittedCount = roundProgress.players.filter(
      (player) => player.submitted
    ).length;

    return {
      statusLabel: 'Waiting',
      title: roundTitle,
      subtitle: `${submittedCount} of ${roundProgress.players.length} ready.`,
    };
  }

  return {
    statusLabel: 'Writing',
    title: 'Writing',
    subtitle: 'Loading the next step.',
  };
}

export function buildRevealChromeCopy({
  allRevealed,
}: {
  allRevealed: boolean;
}): RoomChromeCopy {
  return {
    statusLabel: allRevealed ? 'Done' : 'Reveal',
    title: allRevealed ? 'All poems revealed' : 'Reveal poems',
    subtitle: allRevealed
      ? 'Start again, open the archive, or leave the room.'
      : 'Read one poem at a time.',
  };
}
