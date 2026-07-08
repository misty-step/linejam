import { WORD_COUNTS } from '@/convex/lib/gameRules';
import { formatRoomCode } from '@/lib/roomCode';

export interface RoomChromeCopy {
  title: string;
  subtitle: string;
}

interface ChromeAssignment {
  lineIndex: number;
  targetWordCount: number;
  totalRounds?: number;
  isFinalRound?: boolean;
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
    const wordLabel = `${targetWordCount} word${targetWordCount === 1 ? '' : 's'}`;

    // The placeholder and the WordSlots squares already state the word count, and
    // "you only see the previous line" is a one-time rule, not a per-round notice.
    // Keep the chrome to a single glanceable line.
    const roundLabel = assignment.isFinalRound ? 'Last line' : null;
    const displayRoundLabel = roundLabel ?? `Round ${roundNumber}`;

    return {
      title: roundNumber ? `${displayRoundLabel} · ${wordLabel}` : wordLabel,
      subtitle: '',
    };
  }

  if (roundProgress) {
    const submittedCount = roundProgress.players.filter(
      (player) => player.submitted
    ).length;

    return {
      title: roundTitle,
      subtitle: `${submittedCount} of ${roundProgress.players.length} ready.`,
    };
  }

  return {
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
    title: allRevealed ? 'All poems revealed' : 'Reveal poems',
    subtitle: allRevealed
      ? 'Start again, open the archive, or leave the room.'
      : 'Read one poem at a time.',
  };
}
