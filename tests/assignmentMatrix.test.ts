import { test, expect, describe } from 'vitest';
import {
  generateAssignmentMatrix,
  getMatrixRound,
} from '../convex/lib/assignmentMatrix';
import { Id } from '../convex/_generated/dataModel';

// Helper to create mock user IDs
const createMockUserIds = (count: number): Id<'users'>[] => {
  return Array.from({ length: count }, (_, i) => `user_${i}` as Id<'users'>);
};

const expectNoConsecutiveAssignments = (
  matrix: Id<'users'>[][],
  playerCount: number
) => {
  for (let r = 1; r < matrix.length; r++) {
    const currentRound = matrix[r];
    const previousRound = matrix[r - 1];

    for (let poemIndex = 0; poemIndex < playerCount; poemIndex++) {
      // A conflict means the same user wrote for the same poem in consecutive rounds
      expect(currentRound[poemIndex]).not.toBe(previousRound[poemIndex]);
    }
  }
};

describe('generateAssignmentMatrix', () => {
  test('should return an empty matrix for 0 players', () => {
    const userIds: Id<'users'>[] = [];
    const matrix = generateAssignmentMatrix(userIds, 9);
    expect(matrix).toEqual([]);
  });

  test('should return an empty matrix for 0 rounds', () => {
    const userIds = createMockUserIds(3);
    expect(generateAssignmentMatrix(userIds, 0)).toEqual([]);
    expect(generateAssignmentMatrix(userIds, -1)).toEqual([]);
  });

  test('should generate an RxP matrix for the requested round count', () => {
    const userIds = createMockUserIds(4); // 4 players

    for (const rounds of [5, 9]) {
      const matrix = generateAssignmentMatrix(userIds, rounds);
      expect(matrix.length).toBe(rounds);
      matrix.forEach((round) => {
        expect(round.length).toBe(userIds.length); // Each round has P assignments
      });
    }
  });

  test('each row should be a permutation of all players', () => {
    const userIds = createMockUserIds(5); // 5 players
    const matrix = generateAssignmentMatrix(userIds, 9);

    matrix.forEach((round) => {
      // Check that each user appears exactly once in the round
      const seenUsers = new Set<Id<'users'>>();
      round.forEach((userId) => seenUsers.add(userId));
      expect(seenUsers.size).toBe(userIds.length); // All users present
      userIds.forEach((userId) => expect(seenUsers.has(userId)).toBe(true)); // No extra users
    });
  });

  test('should ensure no consecutive assignments on the same poem', () => {
    const userIds = createMockUserIds(8); // 8 players
    const matrix = generateAssignmentMatrix(userIds, 9);
    expectNoConsecutiveAssignments(matrix, userIds.length);
  });

  test('quick-jam shape (5 rounds) keeps the no-consecutive invariant', () => {
    const userIds = createMockUserIds(6);
    const matrix = generateAssignmentMatrix(userIds, 5);

    expect(matrix.length).toBe(5);
    matrix.forEach((round) => expect(round.length).toBe(6));
    expectNoConsecutiveAssignments(matrix, userIds.length);
  });

  test('should work with 2 players (edge case)', () => {
    const userIds = createMockUserIds(2); // 2 players
    const matrix = generateAssignmentMatrix(userIds, 9);

    expect(matrix.length).toBe(9);
    matrix.forEach((round) => expect(round.length).toBe(2));
    expectNoConsecutiveAssignments(matrix, userIds.length);
  });

  test('should work with 8 players (edge case)', () => {
    const userIds = createMockUserIds(8); // 8 players
    const matrix = generateAssignmentMatrix(userIds, 9);

    expect(matrix.length).toBe(9);
    matrix.forEach((round) => expect(round.length).toBe(8));
    expectNoConsecutiveAssignments(matrix, userIds.length);
  });

  test('should handle small number of players correctly without infinite loops (e.g., 1 player)', () => {
    // For 1 player, it's impossible to avoid consecutive assignments.
    // The current algorithm's conflict resolution might struggle here or warn.
    // The main goal is it doesn't loop infinitely.
    const userIds = createMockUserIds(1);
    const matrix = generateAssignmentMatrix(userIds, 9);

    expect(matrix.length).toBe(9);
    expect(matrix[0][0]).toBe(userIds[0]);
    // Expecting the algorithm to potentially warn, but complete.
    // The `hasConflicts` will always be true for 1 player.
    // The test mainly ensures it doesn't crash or run forever.
  });
});

describe('getMatrixRound', () => {
  const matrix = [
    ['u0', 'u1'],
    ['u1', 'u0'],
  ] as Id<'users'>[][];

  test('returns the correct round row for valid index', () => {
    expect(getMatrixRound(matrix, 0)).toEqual(['u0', 'u1']);
    expect(getMatrixRound(matrix, 1)).toEqual(['u1', 'u0']);
  });

  test('throws ConvexError for round >= matrix length', () => {
    expect(() => getMatrixRound(matrix, 2)).toThrow(
      'Invalid game state: round 2 out of bounds'
    );
    expect(() => getMatrixRound(matrix, 9)).toThrow(
      'Invalid game state: round 9 out of bounds'
    );
  });

  test('throws ConvexError for negative round', () => {
    expect(() => getMatrixRound(matrix, -1)).toThrow(
      'Invalid game state: round -1 out of bounds'
    );
  });

  test('throws ConvexError for empty matrix', () => {
    expect(() => getMatrixRound([], 0)).toThrow(
      'Invalid game state: round 0 out of bounds'
    );
  });
});
