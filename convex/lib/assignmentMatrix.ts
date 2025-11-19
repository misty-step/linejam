import { Id } from '../_generated/dataModel';

// Helper to shuffle an array (Fisher-Yates algorithm)
function shuffle<T>(array: T[]): T[] {
  let currentIndex = array.length,
    randomIndex;

  // While there remain elements to shuffle.
  while (currentIndex !== 0) {
    // Pick a remaining element.
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
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
  matrix[0] = shuffle([...userIds]);

  // Rounds 1-8: ensure no consecutive assignments
  for (let r = 1; r < 9; r++) {
    let currentPerm = shuffle([...userIds]);
    let attempts = 0;
    const MAX_ATTEMPTS = 1000; // Prevent infinite loops for impossible configurations

    while (
      hasConflicts(currentPerm, matrix[r - 1]) &&
      attempts < MAX_ATTEMPTS
    ) {
      attempts++;
      let resolvedConflict = false;

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
            resolvedConflict = true;
            // Re-check for conflicts after swap, or continue trying to resolve
            // For simplicity and to avoid complex state tracking, we might reshuffle if still conflicted
          }
        }
      }

      // Fallback: if conflicts persist or couldn't be resolved by simple swaps, reshuffle
      if (hasConflicts(currentPerm, matrix[r - 1])) {
        currentPerm = shuffle([...userIds]);
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
