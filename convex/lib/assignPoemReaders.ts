import { ConvexError } from 'convex/values';
import type { Id } from '../_generated/dataModel';

interface Poem {
  _id: Id<'poems'>;
  indexInRoom: number;
}

/**
 * Assign each completed poem to the player one seat after its round-zero
 * author. The immutable round-zero assignment row is the seat order for this
 * game, so this is deterministic, balanced, and never assigns a player their
 * own poem when there are at least two players.
 */
export function assignPoemReaders(
  poems: readonly Poem[],
  roundZeroAssignments: readonly Id<'users'>[]
): Map<Id<'poems'>, Id<'users'>> {
  if (roundZeroAssignments.length < 2) {
    throw new ConvexError('Cannot assign readers with fewer than two players');
  }

  const assignments = new Map<Id<'poems'>, Id<'users'>>();

  for (const poem of poems) {
    if (
      !Number.isInteger(poem.indexInRoom) ||
      poem.indexInRoom < 0 ||
      poem.indexInRoom >= roundZeroAssignments.length
    ) {
      throw new ConvexError('Cannot assign reader for poem outside game seats');
    }
    const readerIndex = (poem.indexInRoom + 1) % roundZeroAssignments.length;
    const readerId = roundZeroAssignments[readerIndex];
    if (!readerId) {
      throw new ConvexError('Cannot assign reader for poem outside game seats');
    }
    assignments.set(poem._id, readerId);
  }
  return assignments;
}
