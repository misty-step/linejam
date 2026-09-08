import { WORD_COUNTS } from '@/convex/lib/gameRules';

export interface RoomChromeCopy {
  title: string;
  subtitle: string;
}

interface ChromeAssignment {
  lineIndex: number;
  totalRounds?: number;
}

interface ChromeRoundProgress {
  round: number;
  totalRounds?: number;
}

export function buildLobbyChromeCopy({
  playerCount,
}: {
  playerCount: number;
}): RoomChromeCopy {
  return {
    title: playerCount < 2 ? 'Waiting for players' : 'Ready to start',
    subtitle: '',
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
  return {
    title: roundNumber ? `Round ${roundNumber} of ${totalRounds}` : 'Writing',
    subtitle: '',
  };
}

export function buildRevealChromeCopy({
  allRevealed,
}: {
  allRevealed: boolean;
}): RoomChromeCopy {
  return {
    title: allRevealed ? 'All poems read' : 'Reading circle',
    subtitle: '',
  };
}
