/**
 * Poem Reader Assignment Module
 *
 * Deep module with simple interface: assign readers to poems.
 * Hides complexity: shuffling, derangement, AI handling, fairness.
 *
 * Design principle (Ousterhout):
 * - Shallow interface: One function, clear semantics
 * - Deep implementation: Complex logic hidden from callers
 * - No leaky abstractions: Callers don't know about AI players
 */

import { Id } from '../_generated/dataModel';

interface Poem {
  _id: Id<'poems'>;
  authorUserId: Id<'users'>;
}

interface Player {
  userId: Id<'users'>;
  kind?: 'AI' | 'human';
}

/**
 * Assign poem readers ensuring fairness and coverage.
 *
 * Rules:
 * - All poems must be assigned a reader
 * - No player reads their own started poem (derangement)
 * - Distribution is as fair as possible
 * - If N poems, N-1 human players: one player reads 2 distinct poems
 * - AI players are excluded from reading
 *
 * @param poems - All completed poems with author info
 * @param allPlayers - All players (human + AI)
 * @param shuffler - Optional shuffle function (default: crypto-secure).
 *                   Tests can inject an identity or deterministic shuffler.
 * @returns Map of poemId → readerId
 *
 * @throws Error if no human players (can't assign readers)
 */
export function assignPoemReaders(
  poems: Poem[],
  allPlayers: Player[],
  shuffler: <T>(arr: T[]) => T[] = shuffle
): Map<Id<'poems'>, Id<'users'>> {
  // Filter human players (AI can't read aloud)
  const humanPlayers = allPlayers.filter((p) => p.kind !== 'AI');

  if (humanPlayers.length === 0) {
    throw new Error('Cannot assign readers: no human players');
  }

  // Shuffle poems for randomness (avoid predictable patterns)
  const shuffledPoems = shuffler([...poems]);

  // Round-robin assignment with derangement constraint
  const assignments = new Map<Id<'poems'>, Id<'users'>>();
  let readerIndex = 0;

  for (const poem of shuffledPoems) {
    // Find next reader that didn't author this poem
    let attempts = 0;
    const maxAttempts = humanPlayers.length;

    while (
      humanPlayers[readerIndex].userId === poem.authorUserId &&
      attempts < maxAttempts
    ) {
      readerIndex = (readerIndex + 1) % humanPlayers.length;
      attempts++;
    }

    // Edge case: single player authored all poems (can't avoid self-read)
    // Still assign them - better than no reader
    assignments.set(poem._id, humanPlayers[readerIndex].userId);

    // Move to next reader for fairness
    readerIndex = (readerIndex + 1) % humanPlayers.length;
  }

  return assignments;
}

/**
 * Fisher-Yates shuffle (unbiased randomization).
 * Hidden implementation detail - callers don't need to know we shuffle.
 */
function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    // Convex-safe random using crypto.getRandomValues
    const randomBytes = new Uint32Array(1);
    crypto.getRandomValues(randomBytes);
    const j = randomBytes[0] % (i + 1);

    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
