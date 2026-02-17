import { ConvexError } from 'convex/values';
import { Id } from '../_generated/dataModel';

/**
 * Generate a cryptographically secure random integer in [0, max).
 * Uses rejection sampling to avoid modulo bias.
 */
function secureRandomInt(max: number): number {
  if (max <= 0) return 0;

  // Find the largest multiple of max that fits in uint32
  const limit = Math.floor(0xffffffff / max) * max;
  const randomValues = new Uint32Array(1);

  let value: number;
  let iterations = 0;
  do {
    if (iterations++ >= 100) {
      throw new Error(
        'secureRandomInt: Failed to generate unbiased random after 100 attempts'
      );
    }
    crypto.getRandomValues(randomValues);
    value = randomValues[0];
  } while (value >= limit);

  return value % max;
}

/**
 * Cryptographically secure Fisher-Yates shuffle.
 * Exported for use in other modules that need secure shuffling.
 */
export function secureShuffle<T>(array: T[]): T[] {
  let currentIndex = array.length;

  while (currentIndex !== 0) {
    const randomIndex = secureRandomInt(currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex],
      array[currentIndex],
    ];
  }

  return array;
}

// Helper to check for conflicts (user writes consecutive lines on the same poem)
// A conflict occurs if perm[j] (current round's author for poem j) is the same as prevPerm[j] (previous round's author for poem j)
function hasConflicts<T>(currentPerm: T[], previousPerm: T[]): boolean {
  for (let j = 0; j < currentPerm.length; j++) {
    if (currentPerm[j] === previousPerm[j]) {
      return true;
    }
  }
  return false;
}

// Helper to find a suitable swap target to resolve a conflict
function findSwapTarget<T>(
  conflictIndex: number,
  currentPerm: T[],
  previousPerm: T[]
): number {
  const n = currentPerm.length;
  const conflictingUser = currentPerm[conflictIndex];
  const previousConflictingUser = previousPerm[conflictIndex];

  for (let k = 0; k < n; k++) {
    // We want to swap currentPerm[conflictIndex] with currentPerm[k]
    // Conditions for a valid swap:
    // 1. currentPerm[k] is not the same as previousPerm[k] (to avoid creating a new conflict at k)
    // 2. The conflicting user (currentPerm[conflictIndex]) doesn't create a conflict at k if moved there
    // 3. The user at k (currentPerm[k]) doesn't create a conflict at conflictIndex if moved there
    if (
      k !== conflictIndex &&
      currentPerm[k] !== previousPerm[k] && // currentPerm[k] is not a conflict
      conflictingUser !== previousPerm[k] && // moving conflictingUser to k won't cause conflict at k
      currentPerm[k] !== previousConflictingUser // moving currentPerm[k] to conflictIndex won't cause conflict at conflictIndex
    ) {
      return k;
    }
  }
  return -1; // No suitable swap target found
}

/**
 * Bounds-checked access to an assignment matrix row.
 * Throws ConvexError if round is out of bounds (corrupted state or logic bug).
 */
export function getMatrixRound(
  matrix: Id<'users'>[][],
  round: number
): Id<'users'>[] {
  if (round < 0 || round >= matrix.length) {
    throw new ConvexError(
      `Invalid game state: round ${round} out of bounds (matrix has ${matrix.length} rounds)`
    );
  }
  return matrix[round];
}

// Implements the assignment matrix generation algorithm from TASK.md 2.3.2
export function generateAssignmentMatrix(
  userIds: Id<'users'>[]
): Id<'users'>[][] {
  const numPlayers = userIds.length;
  const matrix: Id<'users'>[][] = [];

  if (numPlayers === 0) {
    return [];
  }

  // Round 0: random permutation
  matrix[0] = secureShuffle([...userIds]);

  // Rounds 1-8: ensure no consecutive assignments
  for (let r = 1; r < 9; r++) {
    let currentPerm = secureShuffle([...userIds]);
    let attempts = 0;
    const MAX_ATTEMPTS = 1000; // Prevent infinite loops for impossible configurations

    while (
      hasConflicts(currentPerm, matrix[r - 1]) &&
      attempts < MAX_ATTEMPTS
    ) {
      attempts++;

      // Try to resolve conflicts by swapping
      for (let j = 0; j < numPlayers; j++) {
        if (currentPerm[j] === matrix[r - 1][j]) {
          // Conflict at position j
          const swapTargetIndex = findSwapTarget(j, currentPerm, matrix[r - 1]);
          if (swapTargetIndex !== -1) {
            [currentPerm[j], currentPerm[swapTargetIndex]] = [
              currentPerm[swapTargetIndex],
              currentPerm[j],
            ];
            // Re-check for conflicts after swap, or continue trying to resolve
            // For simplicity and to avoid complex state tracking, we might reshuffle if still conflicted
          }
        }
      }

      // Fallback: if conflicts persist or couldn't be resolved by simple swaps, reshuffle
      if (hasConflicts(currentPerm, matrix[r - 1])) {
        currentPerm = secureShuffle([...userIds]);
      }
    }

    if (attempts >= MAX_ATTEMPTS) {
      // This case indicates an extremely difficult or impossible permutation for the given number of players
      // For now, we'll allow a potentially conflicting permutation, but ideally this should error or retry more intelligently
      console.warn(
        `Could not find conflict-free permutation for round ${r} after ${MAX_ATTEMPTS} attempts. Allowing potential conflicts.`
      );
    }

    matrix[r] = currentPerm;
  }

  return matrix;
}
