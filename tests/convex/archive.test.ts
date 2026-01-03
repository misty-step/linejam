import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockDb, createMockCtx } from '../helpers/mockConvexDb';

// Mock Convex server functions
vi.mock('../../convex/_generated/server', () => ({
  query: (args: unknown) => args,
}));

import { getArchiveData } from '../../convex/archive';

// Mock getUser
const mockGetUser = vi.fn();
vi.mock('../../convex/lib/auth', () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
}));

describe('archive', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockDb: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockCtx: any;

  beforeEach(() => {
    mockDb = createMockDb();
    mockCtx = createMockCtx(mockDb);
    mockGetUser.mockReset();
  });

  describe('getArchiveData', () => {
    it('returns empty array when user is not authenticated', async () => {
      mockGetUser.mockResolvedValue(null);

      // @ts-expect-error - calling handler directly for test
      const result = await getArchiveData.handler(mockCtx, {});

      expect(result).toEqual({ poems: [], stats: null });
    });

    it('returns empty stats when user has no lines', async () => {
      mockGetUser.mockResolvedValue({ _id: 'user1', guestId: 'guest1' });
      mockDb.collect.mockResolvedValue([]);

      // @ts-expect-error - calling handler directly for test
      const result = await getArchiveData.handler(mockCtx, {
        guestToken: 'token123',
      });

      expect(result.poems).toEqual([]);
      expect(result.stats).toEqual({
        totalPoems: 0,
        totalFavorites: 0,
        uniqueCollaborators: 0,
        totalLinesWritten: 0,
      });
    });

    it('returns enriched poems with all metadata', async () => {
      const mockUser = {
        _id: 'user1',
        guestId: 'guest1',
        clerkUserId: null,
        displayName: 'Test User',
      };
      const mockLine = {
        _id: 'line1',
        poemId: 'poem1',
        authorUserId: 'user1',
        authorDisplayName: 'Test User',
        text: 'Hello',
        wordCount: 1,
        indexInPoem: 0,
      };
      const mockLine2 = {
        _id: 'line2',
        poemId: 'poem1',
        authorUserId: 'user2',
        authorDisplayName: 'Other User',
        text: 'World today',
        wordCount: 2,
        indexInPoem: 1,
      };
      const mockPoem = {
        _id: 'poem1',
        roomId: 'room1',
        createdAt: Date.now(),
      };
      const mockRoom = {
        _id: 'room1',
        createdAt: Date.now() - 1000,
      };
      const mockOtherUser = {
        _id: 'user2',
        guestId: 'guest2',
        displayName: 'Other User',
        kind: 'human',
      };

      mockGetUser.mockResolvedValue(mockUser);

      // Mock the various query chains
      let collectCallCount = 0;
      mockDb.collect.mockImplementation(() => {
        collectCallCount++;
        if (collectCallCount === 1) return [mockLine, mockLine2]; // User lines
        if (collectCallCount === 2) return []; // Favorites
        if (collectCallCount === 3) return [mockLine, mockLine2]; // Poem lines
        return [];
      });

      mockDb.get.mockImplementation((id: string) => {
        if (id === 'poem1') return mockPoem;
        if (id === 'room1') return mockRoom;
        if (id === 'user1') return mockUser;
        if (id === 'user2') return mockOtherUser;
        return null;
      });

      // @ts-expect-error - calling handler directly for test
      const result = await getArchiveData.handler(mockCtx, {
        guestToken: 'token123',
      });

      expect(result.poems.length).toBe(1);
      expect(result.poems[0]).toMatchObject({
        _id: 'poem1',
        preview: 'Hello',
        lineCount: 2,
        poetCount: 2,
        isFavorited: false,
      });
      expect(result.poems[0].lines).toHaveLength(2);
      expect(result.stats).toMatchObject({
        totalPoems: 1,
        totalLinesWritten: 2,
      });
    });

    it('correctly identifies favorited poems', async () => {
      const mockUser = {
        _id: 'user1',
        guestId: 'guest1',
        clerkUserId: null,
      };
      const mockLine = {
        _id: 'line1',
        poemId: 'poem1',
        authorUserId: 'user1',
        text: 'Hello',
        wordCount: 1,
        indexInPoem: 0,
      };
      const mockPoem = {
        _id: 'poem1',
        roomId: 'room1',
        createdAt: Date.now(),
      };
      const mockFavorite = {
        poemId: 'poem1',
        userId: 'user1',
        createdAt: Date.now(),
      };

      mockGetUser.mockResolvedValue(mockUser);

      let collectCallCount = 0;
      mockDb.collect.mockImplementation(() => {
        collectCallCount++;
        if (collectCallCount === 1) return [mockLine];
        if (collectCallCount === 2) return [mockFavorite];
        if (collectCallCount === 3) return [mockLine];
        return [];
      });

      mockDb.get.mockImplementation((id: string) => {
        if (id === 'poem1') return mockPoem;
        if (id === 'room1') return { createdAt: Date.now() };
        if (id === 'user1') return mockUser;
        return null;
      });

      // @ts-expect-error - calling handler directly for test
      const result = await getArchiveData.handler(mockCtx, {
        guestToken: 'token123',
      });

      expect(result.poems[0].isFavorited).toBe(true);
      expect(result.poems[0].favoritedAt).toBeDefined();
      expect(result.stats?.totalFavorites).toBe(1);
    });

    it('handles AI authors correctly', async () => {
      const mockUser = { _id: 'user1', guestId: 'guest1' };
      const mockAiUser = {
        _id: 'ai1',
        guestId: 'ai-guest',
        displayName: 'Bot',
        kind: 'AI',
      };
      const mockLine = {
        _id: 'line1',
        poemId: 'poem1',
        authorUserId: 'ai1',
        text: 'Generated',
        wordCount: 1,
        indexInPoem: 0,
      };
      const mockPoem = { _id: 'poem1', roomId: 'room1', createdAt: Date.now() };

      mockGetUser.mockResolvedValue(mockUser);

      let collectCallCount = 0;
      mockDb.collect.mockImplementation(() => {
        collectCallCount++;
        if (collectCallCount === 1) return [mockLine];
        if (collectCallCount === 2) return [];
        if (collectCallCount === 3) return [mockLine];
        return [];
      });

      mockDb.get.mockImplementation((id: string) => {
        if (id === 'poem1') return mockPoem;
        if (id === 'room1') return { createdAt: Date.now() };
        if (id === 'ai1') return mockAiUser;
        return null;
      });

      // @ts-expect-error - calling handler directly for test
      const result = await getArchiveData.handler(mockCtx, {
        guestToken: 'token123',
      });

      expect(result.poems[0].lines[0].isBot).toBe(true);
    });

    it('calculates unique collaborators excluding self', async () => {
      const mockUser = {
        _id: 'user1',
        guestId: 'guest1',
        clerkUserId: 'clerk1',
      };
      const mockLines = [
        {
          _id: 'l1',
          poemId: 'poem1',
          authorUserId: 'user1',
          text: 'A',
          wordCount: 1,
          indexInPoem: 0,
        },
        {
          _id: 'l2',
          poemId: 'poem1',
          authorUserId: 'user2',
          text: 'B',
          wordCount: 1,
          indexInPoem: 1,
        },
        {
          _id: 'l3',
          poemId: 'poem1',
          authorUserId: 'user3',
          text: 'C',
          wordCount: 1,
          indexInPoem: 2,
        },
      ];
      const mockPoem = { _id: 'poem1', roomId: 'room1', createdAt: Date.now() };

      mockGetUser.mockResolvedValue(mockUser);

      let collectCallCount = 0;
      mockDb.collect.mockImplementation(() => {
        collectCallCount++;
        if (collectCallCount === 1) return mockLines;
        if (collectCallCount === 2) return [];
        if (collectCallCount === 3) return mockLines;
        return [];
      });

      mockDb.get.mockImplementation((id: string) => {
        if (id === 'poem1') return mockPoem;
        if (id === 'room1') return { createdAt: Date.now() };
        if (id === 'user1') return mockUser;
        if (id === 'user2')
          return { _id: 'user2', guestId: 'guest2', displayName: 'User 2' };
        if (id === 'user3')
          return { _id: 'user3', guestId: 'guest3', displayName: 'User 3' };
        return null;
      });

      // @ts-expect-error - calling handler directly for test
      const result = await getArchiveData.handler(mockCtx, {
        guestToken: 'token123',
      });

      // 2 collaborators (user2, user3), not counting self
      expect(result.stats?.uniqueCollaborators).toBe(2);
    });

    it('limits coAuthors to 3 entries', async () => {
      const mockUser = { _id: 'user1', guestId: 'guest1' };
      const mockLines = [
        {
          _id: 'l1',
          poemId: 'poem1',
          authorUserId: 'user1',
          text: 'A',
          wordCount: 1,
          indexInPoem: 0,
        },
        {
          _id: 'l2',
          poemId: 'poem1',
          authorUserId: 'user2',
          text: 'B',
          wordCount: 1,
          indexInPoem: 1,
        },
        {
          _id: 'l3',
          poemId: 'poem1',
          authorUserId: 'user3',
          text: 'C',
          wordCount: 1,
          indexInPoem: 2,
        },
        {
          _id: 'l4',
          poemId: 'poem1',
          authorUserId: 'user4',
          text: 'D',
          wordCount: 1,
          indexInPoem: 3,
        },
        {
          _id: 'l5',
          poemId: 'poem1',
          authorUserId: 'user5',
          text: 'E',
          wordCount: 1,
          indexInPoem: 4,
        },
      ];
      const mockPoem = { _id: 'poem1', roomId: 'room1', createdAt: Date.now() };

      mockGetUser.mockResolvedValue(mockUser);

      let collectCallCount = 0;
      mockDb.collect.mockImplementation(() => {
        collectCallCount++;
        if (collectCallCount === 1) return mockLines;
        if (collectCallCount === 2) return [];
        if (collectCallCount === 3) return mockLines;
        return [];
      });

      mockDb.get.mockImplementation((id: string) => {
        if (id === 'poem1') return mockPoem;
        if (id === 'room1') return { createdAt: Date.now() };
        const userNum = id.replace('user', '');
        return {
          _id: id,
          guestId: `guest${userNum}`,
          displayName: `User ${userNum}`,
        };
      });

      // @ts-expect-error - calling handler directly for test
      const result = await getArchiveData.handler(mockCtx, {
        guestToken: 'token123',
      });

      // CoAuthors limited to 3
      expect(result.poems[0].coAuthors).toHaveLength(3);
    });

    it('sorts poems by creation date descending', async () => {
      const mockUser = { _id: 'user1', guestId: 'guest1' };
      const now = Date.now();
      const mockLines = [
        {
          _id: 'l1',
          poemId: 'poem1',
          authorUserId: 'user1',
          text: 'A',
          wordCount: 1,
          indexInPoem: 0,
        },
        {
          _id: 'l2',
          poemId: 'poem2',
          authorUserId: 'user1',
          text: 'B',
          wordCount: 1,
          indexInPoem: 0,
        },
      ];
      const mockPoem1 = {
        _id: 'poem1',
        roomId: 'room1',
        createdAt: now - 10000,
      };
      const mockPoem2 = { _id: 'poem2', roomId: 'room1', createdAt: now };

      mockGetUser.mockResolvedValue(mockUser);

      let collectCallCount = 0;
      mockDb.collect.mockImplementation(() => {
        collectCallCount++;
        if (collectCallCount === 1) return mockLines;
        if (collectCallCount === 2) return [];
        if (collectCallCount === 3)
          return [
            {
              _id: 'l1',
              poemId: 'poem1',
              authorUserId: 'user1',
              text: 'A',
              wordCount: 1,
              indexInPoem: 0,
            },
          ];
        if (collectCallCount === 4)
          return [
            {
              _id: 'l2',
              poemId: 'poem2',
              authorUserId: 'user1',
              text: 'B',
              wordCount: 1,
              indexInPoem: 0,
            },
          ];
        return [];
      });

      mockDb.get.mockImplementation((id: string) => {
        if (id === 'poem1') return mockPoem1;
        if (id === 'poem2') return mockPoem2;
        if (id === 'room1') return { createdAt: now };
        if (id === 'user1') return mockUser;
        return null;
      });

      // @ts-expect-error - calling handler directly for test
      const result = await getArchiveData.handler(mockCtx, {
        guestToken: 'token123',
      });

      // Most recent first
      expect(result.poems[0]._id).toBe('poem2');
      expect(result.poems[1]._id).toBe('poem1');
    });

    it('handles null poems gracefully', async () => {
      const mockUser = { _id: 'user1', guestId: 'guest1' };
      const mockLine = {
        _id: 'line1',
        poemId: 'deleted_poem',
        authorUserId: 'user1',
        text: 'Orphan',
        wordCount: 1,
        indexInPoem: 0,
      };

      mockGetUser.mockResolvedValue(mockUser);

      let collectCallCount = 0;
      mockDb.collect.mockImplementation(() => {
        collectCallCount++;
        if (collectCallCount === 1) return [mockLine];
        if (collectCallCount === 2) return [];
        return [];
      });

      // Return null for deleted poem
      mockDb.get.mockResolvedValue(null);

      // @ts-expect-error - calling handler directly for test
      const result = await getArchiveData.handler(mockCtx, {
        guestToken: 'token123',
      });

      // Should filter out null poems
      expect(result.poems).toEqual([]);
    });

    it('handles null room gracefully with fallback date', async () => {
      const mockUser = { _id: 'user1', guestId: 'guest1' };
      const poemCreatedAt = Date.now();
      const mockLine = {
        _id: 'line1',
        poemId: 'poem1',
        authorUserId: 'user1',
        text: 'Hello',
        wordCount: 1,
        indexInPoem: 0,
      };
      const mockPoem = {
        _id: 'poem1',
        roomId: 'deleted_room',
        createdAt: poemCreatedAt,
      };

      mockGetUser.mockResolvedValue(mockUser);

      let collectCallCount = 0;
      mockDb.collect.mockImplementation(() => {
        collectCallCount++;
        if (collectCallCount === 1) return [mockLine];
        if (collectCallCount === 2) return [];
        if (collectCallCount === 3) return [mockLine];
        return [];
      });

      mockDb.get.mockImplementation((id: string) => {
        if (id === 'poem1') return mockPoem;
        if (id === 'deleted_room') return null; // Room deleted
        if (id === 'user1') return mockUser;
        return null;
      });

      // @ts-expect-error - calling handler directly for test
      const result = await getArchiveData.handler(mockCtx, {
        guestToken: 'token123',
      });

      // roomDate should fallback to poem.createdAt when room is null
      expect(result.poems[0].roomDate).toBe(poemCreatedAt);
    });

    it('handles null author gracefully with fallbacks', async () => {
      const mockUser = { _id: 'user1', guestId: 'guest1' };
      const mockLine = {
        _id: 'line1',
        poemId: 'poem1',
        authorUserId: 'deleted_user',
        // No authorDisplayName
        text: 'Mystery',
        wordCount: 1,
        indexInPoem: 0,
      };
      const mockPoem = { _id: 'poem1', roomId: 'room1', createdAt: Date.now() };
      const mockRoom = { _id: 'room1', createdAt: Date.now() };

      mockGetUser.mockResolvedValue(mockUser);

      let collectCallCount = 0;
      mockDb.collect.mockImplementation(() => {
        collectCallCount++;
        if (collectCallCount === 1) return [mockLine];
        if (collectCallCount === 2) return [];
        if (collectCallCount === 3) return [mockLine];
        return [];
      });

      mockDb.get.mockImplementation((id: string) => {
        if (id === 'poem1') return mockPoem;
        if (id === 'room1') return mockRoom;
        if (id === 'deleted_user') return null; // Author deleted
        if (id === 'user1') return mockUser;
        return null;
      });

      // @ts-expect-error - calling handler directly for test
      const result = await getArchiveData.handler(mockCtx, {
        guestToken: 'token123',
      });

      const line = result.poems[0].lines[0];
      // Should fallback to line.authorUserId for stableId
      expect(line.authorStableId).toBe('deleted_user');
      // Should fallback to 'Unknown' for name
      expect(line.authorName).toBe('Unknown');
      // Should fallback to false for isBot
      expect(line.isBot).toBe(false);
    });

    it('uses authorDisplayName from line when available', async () => {
      const mockUser = { _id: 'user1', guestId: 'guest1' };
      const mockLine = {
        _id: 'line1',
        poemId: 'poem1',
        authorUserId: 'user1',
        authorDisplayName: 'Line Display Name', // Set on line
        text: 'Hello',
        wordCount: 1,
        indexInPoem: 0,
      };
      const mockPoem = { _id: 'poem1', roomId: 'room1', createdAt: Date.now() };
      const mockRoom = { _id: 'room1', createdAt: Date.now() };
      const mockUserWithDifferentName = {
        _id: 'user1',
        guestId: 'guest1',
        displayName: 'User Display Name', // Different from line
      };

      mockGetUser.mockResolvedValue(mockUser);

      let collectCallCount = 0;
      mockDb.collect.mockImplementation(() => {
        collectCallCount++;
        if (collectCallCount === 1) return [mockLine];
        if (collectCallCount === 2) return [];
        if (collectCallCount === 3) return [mockLine];
        return [];
      });

      mockDb.get.mockImplementation((id: string) => {
        if (id === 'poem1') return mockPoem;
        if (id === 'room1') return mockRoom;
        if (id === 'user1') return mockUserWithDifferentName;
        return null;
      });

      // @ts-expect-error - calling handler directly for test
      const result = await getArchiveData.handler(mockCtx, {
        guestToken: 'token123',
      });

      // Should prefer line.authorDisplayName over author.name
      expect(result.poems[0].lines[0].authorName).toBe('Line Display Name');
    });

    it('handles empty lines array with preview fallback', async () => {
      const mockUser = { _id: 'user1', guestId: 'guest1' };
      // Line references a poem, but when we fetch poem's lines, it's empty
      const mockLine = {
        _id: 'line1',
        poemId: 'poem1',
        authorUserId: 'user1',
        text: 'Hello',
        wordCount: 1,
        indexInPoem: 0,
      };
      const mockPoem = { _id: 'poem1', roomId: 'room1', createdAt: Date.now() };
      const mockRoom = { _id: 'room1', createdAt: Date.now() };

      mockGetUser.mockResolvedValue(mockUser);

      let collectCallCount = 0;
      mockDb.collect.mockImplementation(() => {
        collectCallCount++;
        if (collectCallCount === 1) return [mockLine]; // User's lines
        if (collectCallCount === 2) return []; // Favorites
        if (collectCallCount === 3) return []; // Poem's lines (empty - edge case)
        return [];
      });

      mockDb.get.mockImplementation((id: string) => {
        if (id === 'poem1') return mockPoem;
        if (id === 'room1') return mockRoom;
        if (id === 'user1') return mockUser;
        return null;
      });

      // @ts-expect-error - calling handler directly for test
      const result = await getArchiveData.handler(mockCtx, {
        guestToken: 'token123',
      });

      // Preview should fallback to '...' when no lines
      expect(result.poems[0].preview).toBe('...');
      expect(result.poems[0].lineCount).toBe(0);
    });

    it('handles coAuthor with missing author in map', async () => {
      const mockUser = { _id: 'user1', guestId: 'guest1' };
      const mockLines = [
        {
          _id: 'l1',
          poemId: 'poem1',
          authorUserId: 'user1',
          text: 'A',
          wordCount: 1,
          indexInPoem: 0,
        },
        {
          _id: 'l2',
          poemId: 'poem1',
          authorUserId: 'missing_user',
          text: 'B',
          wordCount: 1,
          indexInPoem: 1,
        },
      ];
      const mockPoem = { _id: 'poem1', roomId: 'room1', createdAt: Date.now() };
      const mockRoom = { _id: 'room1', createdAt: Date.now() };

      mockGetUser.mockResolvedValue(mockUser);

      let collectCallCount = 0;
      mockDb.collect.mockImplementation(() => {
        collectCallCount++;
        if (collectCallCount === 1) return mockLines;
        if (collectCallCount === 2) return [];
        if (collectCallCount === 3) return mockLines;
        return [];
      });

      mockDb.get.mockImplementation((id: string) => {
        if (id === 'poem1') return mockPoem;
        if (id === 'room1') return mockRoom;
        if (id === 'user1') return mockUser;
        if (id === 'missing_user') return null; // User deleted
        return null;
      });

      // @ts-expect-error - calling handler directly for test
      const result = await getArchiveData.handler(mockCtx, {
        guestToken: 'token123',
      });

      // coAuthors should show 'Unknown' for missing user
      expect(result.poems[0].coAuthors).toContain('Unknown');
    });

    it('uses clerkUserId for stableId when available', async () => {
      const mockUser = {
        _id: 'user1',
        guestId: 'guest1',
        clerkUserId: 'clerk1',
      };
      const mockLine = {
        _id: 'line1',
        poemId: 'poem1',
        authorUserId: 'user1',
        text: 'Hello',
        wordCount: 1,
        indexInPoem: 0,
      };
      const mockPoem = { _id: 'poem1', roomId: 'room1', createdAt: Date.now() };
      const mockRoom = { _id: 'room1', createdAt: Date.now() };
      const mockAuthorWithClerk = {
        _id: 'user1',
        guestId: 'guest1',
        clerkUserId: 'clerk_author_1',
        displayName: 'User',
      };

      mockGetUser.mockResolvedValue(mockUser);

      let collectCallCount = 0;
      mockDb.collect.mockImplementation(() => {
        collectCallCount++;
        if (collectCallCount === 1) return [mockLine];
        if (collectCallCount === 2) return [];
        if (collectCallCount === 3) return [mockLine];
        return [];
      });

      mockDb.get.mockImplementation((id: string) => {
        if (id === 'poem1') return mockPoem;
        if (id === 'room1') return mockRoom;
        if (id === 'user1') return mockAuthorWithClerk;
        return null;
      });

      // @ts-expect-error - calling handler directly for test
      const result = await getArchiveData.handler(mockCtx, {
        guestToken: 'token123',
      });

      // Should use clerkUserId as stableId
      expect(result.poems[0].lines[0].authorStableId).toBe('clerk_author_1');
    });
  });
});
