import { test, expect, describe } from 'vitest';
import {
  generateAssignmentMatrix,
  getMatrixRound,
} from '../convex/lib/assignmentMatrix';
import { Id } from '../convex/_generated/dataModel';

// Helper to create mock user IDs
const createMockUserId = (id: string): Id<'users'> => {
  // SAFETY: Mock user IDs are synthetic string identifiers satisfying the Convex Id<'users'> brand for unit tests.
  return id as Id<'users'>;
};

const createMockUserIds = (count: number): Id<'users'>[] => {
  return Array.from({ length: count }, (_, i) => createMockUserId(`user_${i}`));
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
  test('assigns every writer once per round without consecutive same-poem turns at both room-capacity boundaries', () => {
    for (const count of [2, 8]) {
      const userIds = createMockUserIds(count);
      const matrix = generateAssignmentMatrix(userIds, 9);
      expect(matrix).toHaveLength(9);
      for (const round of matrix) {
        expect([...round].sort()).toEqual([...userIds].sort());
      }
      expectNoConsecutiveAssignments(matrix, count);
    }
  });
});

describe('getMatrixRound', () => {
  const matrix: Id<'users'>[][] = [
    [createMockUserId('u0'), createMockUserId('u1')],
    [createMockUserId('u1'), createMockUserId('u0')],
  ];

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
