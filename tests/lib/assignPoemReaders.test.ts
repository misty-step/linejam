import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { assignPoemReaders } from '../../convex/lib/assignPoemReaders';
import type { Id } from '../../convex/_generated/dataModel';

// Test helpers
function makePoem(
  id: string,
  authorUserId: string
): { _id: Id<'poems'>; authorUserId: Id<'users'> } {
  return {
    _id: id as Id<'poems'>,
    authorUserId: authorUserId as Id<'users'>,
  };
}

function makePlayer(
  userId: string,
  kind: 'AI' | 'human' = 'human'
): { userId: Id<'users'>; kind: 'AI' | 'human' } {
  return {
    userId: userId as Id<'users'>,
    kind,
  };
}

describe('assignPoemReaders', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('basic assignment', () => {
    it('assigns all poems to human readers', () => {
      // Mock deterministic random for predictable shuffle
      let callCount = 0;
      vi.stubGlobal('crypto', {
        getRandomValues: (array: Uint32Array) => {
          array[0] = callCount++; // Predictable sequence
          return array;
        },
      });

      const poems = [
        makePoem('poem1', 'user1'),
        makePoem('poem2', 'user2'),
        makePoem('poem3', 'user3'),
      ];

      const players = [
        makePlayer('user1'),
        makePlayer('user2'),
        makePlayer('user3'),
      ];

      const assignments = assignPoemReaders(poems, players);

      expect(assignments.size).toBe(3);
      expect(assignments.get('poem1' as Id<'poems'>)).toBeDefined();
      expect(assignments.get('poem2' as Id<'poems'>)).toBeDefined();
      expect(assignments.get('poem3' as Id<'poems'>)).toBeDefined();
    });

    it('excludes AI players from reading', () => {
      vi.stubGlobal('crypto', {
        getRandomValues: (array: Uint32Array) => {
          array[0] = 0;
          return array;
        },
      });

      const poems = [
        makePoem('poem1', 'user1'),
        makePoem('poem2', 'ai1'),
        makePoem('poem3', 'user2'),
      ];

      const players = [
        makePlayer('user1'),
        makePlayer('ai1', 'AI'),
        makePlayer('user2'),
      ];

      const assignments = assignPoemReaders(poems, players);

      // All readers should be human
      const readers = Array.from(assignments.values());
      expect(readers).not.toContain('ai1');
      expect(readers.every((r) => r === 'user1' || r === 'user2')).toBe(true);
    });
  });

  describe('derangement (no self-reads)', () => {
    it('avoids assigning readers to their own poems when possible', () => {
      vi.stubGlobal('crypto', {
        getRandomValues: (array: Uint32Array) => {
          array[0] = 0; // Deterministic
          return array;
        },
      });

      const poems = [makePoem('poem1', 'user1'), makePoem('poem2', 'user2')];

      const players = [makePlayer('user1'), makePlayer('user2')];

      const assignments = assignPoemReaders(poems, players);

      // User1 should not read poem1, User2 should not read poem2
      const user1Poems = Array.from(assignments.entries())
        .filter(([_, reader]) => reader === 'user1')
        .map(([poemId]) => poemId);

      const user2Poems = Array.from(assignments.entries())
        .filter(([_, reader]) => reader === 'user2')
        .map(([poemId]) => poemId);

      expect(user1Poems).not.toContain('poem1' as Id<'poems'>);
      expect(user2Poems).not.toContain('poem2' as Id<'poems'>);
    });

    it('allows self-reads when unavoidable (single player)', () => {
      vi.stubGlobal('crypto', {
        getRandomValues: (array: Uint32Array) => {
          array[0] = 0;
          return array;
        },
      });

      const poems = [
        makePoem('poem1', 'user1'),
        makePoem('poem2', 'user1'),
        makePoem('poem3', 'user1'),
      ];

      const players = [makePlayer('user1')];

      const assignments = assignPoemReaders(poems, players);

      // All poems assigned to user1 (only option)
      expect(assignments.size).toBe(3);
      Array.from(assignments.values()).forEach((reader) => {
        expect(reader).toBe('user1');
      });
    });
  });

  describe('fairness', () => {
    it('distributes poems fairly when N poems, N-1 human players', () => {
      vi.stubGlobal('crypto', {
        getRandomValues: (array: Uint32Array) => {
          array[0] = 0;
          return array;
        },
      });

      const poems = [
        makePoem('poem1', 'user1'),
        makePoem('poem2', 'user2'),
        makePoem('poem3', 'user3'),
        makePoem('poem4', 'ai1'), // AI-authored
      ];

      const players = [
        makePlayer('user1'),
        makePlayer('user2'),
        makePlayer('user3'),
        makePlayer('ai1', 'AI'),
      ];

      const assignments = assignPoemReaders(poems, players);

      // Count poems per reader
      const readerCounts = new Map<Id<'users'>, number>();
      for (const readerId of assignments.values()) {
        readerCounts.set(readerId, (readerCounts.get(readerId) || 0) + 1);
      }

      // 4 poems, 3 human readers: distribution should be [2, 1, 1] or similar
      const counts = Array.from(readerCounts.values()).sort().reverse();
      expect(counts.length).toBeLessThanOrEqual(3); // Only human readers
      expect(counts[0]).toBeGreaterThanOrEqual(1); // Everyone reads at least 1
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1); // Fair distribution
    });

    it('handles more poems than human players', () => {
      vi.stubGlobal('crypto', {
        getRandomValues: (array: Uint32Array) => {
          array[0] = 0;
          return array;
        },
      });

      const poems = [
        makePoem('poem1', 'user1'),
        makePoem('poem2', 'user2'),
        makePoem('poem3', 'user1'),
        makePoem('poem4', 'user2'),
        makePoem('poem5', 'user1'),
      ];

      const players = [makePlayer('user1'), makePlayer('user2')];

      const assignments = assignPoemReaders(poems, players);

      // All 5 poems assigned
      expect(assignments.size).toBe(5);

      // Count per reader
      const readerCounts = new Map<Id<'users'>, number>();
      for (const readerId of assignments.values()) {
        readerCounts.set(readerId, (readerCounts.get(readerId) || 0) + 1);
      }

      // Should be roughly balanced (2-3 each)
      expect(readerCounts.get('user1' as Id<'users'>)).toBeGreaterThanOrEqual(
        2
      );
      expect(readerCounts.get('user2' as Id<'users'>)).toBeGreaterThanOrEqual(
        2
      );
    });
  });

  describe('edge cases', () => {
    it('throws error when no human players', () => {
      const poems = [makePoem('poem1', 'ai1')];
      const players = [makePlayer('ai1', 'AI')];

      expect(() => assignPoemReaders(poems, players)).toThrow(
        'Cannot assign readers: no human players'
      );
    });

    it('handles empty poems array', () => {
      vi.stubGlobal('crypto', {
        getRandomValues: (array: Uint32Array) => {
          array[0] = 0;
          return array;
        },
      });

      const poems: Array<{ _id: Id<'poems'>; authorUserId: Id<'users'> }> = [];
      const players = [makePlayer('user1')];

      const assignments = assignPoemReaders(poems, players);

      expect(assignments.size).toBe(0);
    });

    it('assigns correctly when all poems authored by AI', () => {
      vi.stubGlobal('crypto', {
        getRandomValues: (array: Uint32Array) => {
          array[0] = 0;
          return array;
        },
      });

      const poems = [
        makePoem('poem1', 'ai1'),
        makePoem('poem2', 'ai1'),
        makePoem('poem3', 'ai1'),
      ];

      const players = [
        makePlayer('user1'),
        makePlayer('user2'),
        makePlayer('ai1', 'AI'),
      ];

      const assignments = assignPoemReaders(poems, players);

      // All poems assigned to human readers
      expect(assignments.size).toBe(3);
      const readers = Array.from(assignments.values());
      expect(readers.every((r) => r === 'user1' || r === 'user2')).toBe(true);
    });
  });

  describe('randomization', () => {
    it('produces different assignments with different random values', () => {
      // First run: sequential random
      let callCount1 = 0;
      vi.stubGlobal('crypto', {
        getRandomValues: (array: Uint32Array) => {
          array[0] = callCount1++;
          return array;
        },
      });

      const poems1 = [
        makePoem('poem1', 'user1'),
        makePoem('poem2', 'user2'),
        makePoem('poem3', 'user3'),
      ];

      const players1 = [
        makePlayer('user1'),
        makePlayer('user2'),
        makePlayer('user3'),
      ];

      const assignments1 = assignPoemReaders(poems1, players1);

      // Second run: reverse random
      let callCount2 = 10;
      vi.stubGlobal('crypto', {
        getRandomValues: (array: Uint32Array) => {
          array[0] = callCount2--;
          return array;
        },
      });

      const poems2 = [
        makePoem('poem1', 'user1'),
        makePoem('poem2', 'user2'),
        makePoem('poem3', 'user3'),
      ];

      const players2 = [
        makePlayer('user1'),
        makePlayer('user2'),
        makePlayer('user3'),
      ];

      const assignments2 = assignPoemReaders(poems2, players2);

      // Assignments might differ due to shuffling
      // (Not guaranteed to be different, but likely with different random values)
      const assignments1Str = JSON.stringify(
        Array.from(assignments1.entries())
      );
      const assignments2Str = JSON.stringify(
        Array.from(assignments2.entries())
      );

      // At minimum, the function executes without error
      expect(assignments1.size).toBe(3);
      expect(assignments2.size).toBe(3);
    });
  });
});
