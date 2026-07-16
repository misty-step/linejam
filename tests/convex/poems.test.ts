import { describe, it, expect } from 'vitest';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { setupConvexTest } from '../helpers/convexTest';
import { type T, asUser, seedClerkUser, seedLine } from '../helpers/convexSeed';

/**
 * poems queries on the real convex-test engine (backlog 018): real
 * read-your-writes + real auth (Clerk identity via t.withIdentity), real
 * participation checks — asserting observable return values and DB state
 * instead of mock-call stubs.
 *
 * Auth-gated queries (getPoemsForRoom / getPoemDetail / getMyPoems) require a
 * user row with clerkUserId and a matching t.withIdentity({ subject }) call —
 * identical to the pattern used in shares.test.ts and favorites.test.ts.
 *
 * Public queries (getPublicPoemPreview / getPublicPoemFull /
 * getPublicSessionRecap) need no auth; they gate on publicShareEnabled /
 * publicRecapEnabled flags and poem.revealedAt instead.
 */

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

/**
 * Seed a minimal room (COMPLETED) with one game and one poem; optionally
 * enroll a participant in roomPlayers.  Returns all created IDs.
 */
async function seedRoom(
  t: T,
  opts: {
    userId: Id<'users'>;
    roomCode?: string;
    roomStatus?: 'LOBBY' | 'IN_PROGRESS' | 'COMPLETED';
    gameStatus?: 'IN_PROGRESS' | 'COMPLETED';
    poemCount?: number;
    publicShareEnabled?: boolean;
    publicRecapEnabled?: boolean;
    revealPoems?: boolean;
    addRoomPlayer?: boolean;
  }
): Promise<{
  roomId: Id<'rooms'>;
  gameId: Id<'games'>;
  poemIds: Id<'poems'>[];
}> {
  const {
    userId,
    roomCode = 'ABCD',
    roomStatus = 'COMPLETED',
    gameStatus = 'COMPLETED',
    poemCount = 1,
    publicShareEnabled,
    publicRecapEnabled,
    revealPoems = false,
    addRoomPlayer = true,
  } = opts;

  return t.run(async (ctx) => {
    const roomId = await ctx.db.insert('rooms', {
      code: roomCode,
      hostUserId: userId,
      status: roomStatus,
      createdAt: 0,
    });

    if (addRoomPlayer) {
      await ctx.db.insert('roomPlayers', {
        roomId,
        userId,
        displayName: 'Player',
        joinedAt: 0,
      });
    }

    const gameId = await ctx.db.insert('games', {
      roomId,
      status: gameStatus,
      cycle: 1,
      currentRound: 0,
      assignmentMatrix: [[userId]],
      createdAt: 0,
      ...(publicRecapEnabled !== undefined ? { publicRecapEnabled } : {}),
    });

    const poemIds: Id<'poems'>[] = [];
    for (let i = 0; i < poemCount; i++) {
      poemIds.push(
        await ctx.db.insert('poems', {
          roomId,
          gameId,
          indexInRoom: i,
          createdAt: i * 1000 + 1000,
          ...(revealPoems ? { revealedAt: 9000 + i } : {}),
          ...(publicShareEnabled !== undefined ? { publicShareEnabled } : {}),
        })
      );
    }

    return { roomId, gameId, poemIds };
  });
}

// ---------------------------------------------------------------------------
// getPoemsForRoom
// ---------------------------------------------------------------------------

describe('getPoemsForRoom', () => {
  it('returns empty array when no Clerk identity is present', async () => {
    const t = setupConvexTest();
    // No auth — getUser returns null.
    const result = await t.query(api.poems.getPoemsForRoom, {
      roomCode: 'ABCD',
    });
    expect(result).toEqual([]);
  });

  it('returns empty array when authenticated user has no user row', async () => {
    const t = setupConvexTest();
    // Identity exists in Clerk but no users row has been seeded.
    const result = await t
      .withIdentity({ subject: 'clerk_ghost' })
      .query(api.poems.getPoemsForRoom, { roomCode: 'ABCD' });
    expect(result).toEqual([]);
  });

  it('returns empty array when room does not exist', async () => {
    const t = setupConvexTest();
    await seedClerkUser(t, 'alice');
    const result = await asUser(t, 'alice').query(api.poems.getPoemsForRoom, {
      roomCode: 'ZZZZ',
    });
    expect(result).toEqual([]);
  });

  it('returns empty array when user is not a participant', async () => {
    const t = setupConvexTest();
    const aliceId = await seedClerkUser(t, 'alice');
    // Seed a room owned by alice but do NOT add bob as a roomPlayer.
    await seedRoom(t, {
      userId: aliceId,
      roomCode: 'ABCD',
      addRoomPlayer: true,
    });
    // Bob exists but is not in roomPlayers.
    await seedClerkUser(t, 'bob');

    const result = await asUser(t, 'bob').query(api.poems.getPoemsForRoom, {
      roomCode: 'ABCD',
    });
    expect(result).toEqual([]);
  });

  it('returns empty array when the room has no game yet', async () => {
    const t = setupConvexTest();
    const aliceId = await seedClerkUser(t, 'alice');
    // Build a bare room/player with no game via t.run directly.
    await t.run(async (ctx) => {
      const roomId = await ctx.db.insert('rooms', {
        code: 'ABCD',
        hostUserId: aliceId,
        status: 'LOBBY',
        createdAt: 0,
      });
      await ctx.db.insert('roomPlayers', {
        roomId,
        userId: aliceId,
        displayName: 'Alice',
        joinedAt: 0,
      });
    });

    const result = await asUser(t, 'alice').query(api.poems.getPoemsForRoom, {
      roomCode: 'ABCD',
    });
    expect(result).toEqual([]);
  });

  it('returns poems with first-line preview for a participant', async () => {
    const t = setupConvexTest();
    const aliceId = await seedClerkUser(t, 'alice');
    const { poemIds } = await seedRoom(t, {
      userId: aliceId,
      poemCount: 2,
      gameStatus: 'IN_PROGRESS',
      roomStatus: 'IN_PROGRESS',
    });

    await seedLine(t, {
      poemId: poemIds[0],
      authorUserId: aliceId,
      text: 'First line of poem one',
    });
    await seedLine(t, {
      poemId: poemIds[1],
      authorUserId: aliceId,
      text: 'First line of poem two',
    });

    const result = await asUser(t, 'alice').query(api.poems.getPoemsForRoom, {
      roomCode: 'ABCD',
    });

    expect(result).toHaveLength(2);
    const previews = result.map((r: { preview: string }) => r.preview).sort();
    expect(previews).toEqual([
      'First line of poem one',
      'First line of poem two',
    ]);
  });

  it('uses "..." fallback preview when a poem has no first line yet', async () => {
    const t = setupConvexTest();
    const aliceId = await seedClerkUser(t, 'alice');
    const { poemIds } = await seedRoom(t, {
      userId: aliceId,
      poemCount: 1,
      gameStatus: 'IN_PROGRESS',
      roomStatus: 'IN_PROGRESS',
    });
    // Insert a line at index 1 only — no first line (index 0).
    await seedLine(t, {
      poemId: poemIds[0],
      authorUserId: aliceId,
      indexInPoem: 1,
      text: 'Second line',
    });

    const result = await asUser(t, 'alice').query(api.poems.getPoemsForRoom, {
      roomCode: 'ABCD',
    });
    expect(result[0].preview).toBe('...');
  });

  it('works for a completed game (reveal phase)', async () => {
    const t = setupConvexTest();
    const aliceId = await seedClerkUser(t, 'alice');
    const { poemIds } = await seedRoom(t, {
      userId: aliceId,
      poemCount: 1,
      gameStatus: 'COMPLETED',
      roomStatus: 'COMPLETED',
      revealPoems: true,
    });
    await seedLine(t, {
      poemId: poemIds[0],
      authorUserId: aliceId,
      text: 'Completed poem line',
    });

    const result = await asUser(t, 'alice').query(api.poems.getPoemsForRoom, {
      roomCode: 'ABCD',
    });
    expect(result).toHaveLength(1);
    expect(result[0].preview).toBe('Completed poem line');
  });
});

// ---------------------------------------------------------------------------
// getPoemDetail
// ---------------------------------------------------------------------------

describe('getPoemDetail', () => {
  it('returns null when no Clerk identity is present', async () => {
    const t = setupConvexTest();
    const aliceId = await seedClerkUser(t, 'alice');
    const { poemIds } = await seedRoom(t, { userId: aliceId });

    const result = await t.query(api.poems.getPoemDetail, {
      poemId: poemIds[0],
    });
    expect(result).toBeNull();
  });

  it('returns null when the poem does not exist', async () => {
    const t = setupConvexTest();
    const aliceId = await seedClerkUser(t, 'alice');
    const { poemIds } = await seedRoom(t, { userId: aliceId });
    // Delete the poem so the id is dangling.
    await t.run((ctx) => ctx.db.delete(poemIds[0]));

    const result = await asUser(t, 'alice').query(api.poems.getPoemDetail, {
      poemId: poemIds[0],
    });
    expect(result).toBeNull();
  });

  it('returns null when the user is not a participant in the poem room', async () => {
    const t = setupConvexTest();
    const aliceId = await seedClerkUser(t, 'alice');
    await seedClerkUser(t, 'bob');
    const { poemIds } = await seedRoom(t, {
      userId: aliceId,
      addRoomPlayer: true,
    });
    // Bob is not in roomPlayers.
    const result = await asUser(t, 'bob').query(api.poems.getPoemDetail, {
      poemId: poemIds[0],
    });
    expect(result).toBeNull();
  });

  it('returns poem with lines sorted by indexInPoem', async () => {
    const t = setupConvexTest();
    const aliceId = await seedClerkUser(t, 'alice');
    const bobId = await seedClerkUser(t, 'bob');
    const charlieId = await seedClerkUser(t, 'charlie');
    const { roomId, poemIds } = await seedRoom(t, {
      userId: aliceId,
      addRoomPlayer: true,
    });
    // Add bob and charlie as room players.
    await t.run(async (ctx) => {
      await ctx.db.insert('roomPlayers', {
        roomId,
        userId: bobId,
        displayName: 'Bob',
        joinedAt: 0,
      });
      await ctx.db.insert('roomPlayers', {
        roomId,
        userId: charlieId,
        displayName: 'Charlie',
        joinedAt: 0,
      });
    });

    // Insert lines out of order.
    await seedLine(t, {
      poemId: poemIds[0],
      authorUserId: charlieId,
      indexInPoem: 2,
      text: 'Third',
    });
    await seedLine(t, {
      poemId: poemIds[0],
      authorUserId: aliceId,
      indexInPoem: 0,
      text: 'First',
    });
    await seedLine(t, {
      poemId: poemIds[0],
      authorUserId: bobId,
      indexInPoem: 1,
      text: 'Second',
    });

    const result = await asUser(t, 'alice').query(api.poems.getPoemDetail, {
      poemId: poemIds[0],
    });

    expect(result).not.toBeNull();
    expect(result?.lines).toHaveLength(3);
    expect(result?.lines[0]).toMatchObject({ text: 'First', indexInPoem: 0 });
    expect(result?.lines[1]).toMatchObject({ text: 'Second', indexInPoem: 1 });
    expect(result?.lines[2]).toMatchObject({ text: 'Third', indexInPoem: 2 });
    expect(result?.lines[0].authorKey).not.toBe(result?.lines[1].authorKey);
    expect(JSON.stringify(result)).not.toContain('authorUserId');
    expect(JSON.stringify(result)).not.toContain('clerkUserId');
    expect(JSON.stringify(result)).not.toContain('guestId');
    expect(JSON.stringify(result)).not.toContain('authorStableId');
  });

  it('returns authorName derived from the user record when no pen name was captured', async () => {
    const t = setupConvexTest();
    const aliceId = await seedClerkUser(t, 'alice');
    const { poemIds } = await seedRoom(t, { userId: aliceId });
    await seedLine(t, {
      poemId: poemIds[0],
      authorUserId: aliceId,
      text: 'Hello',
    });

    const result = await asUser(t, 'alice').query(api.poems.getPoemDetail, {
      poemId: poemIds[0],
    });
    expect(result?.lines[0].authorName).toBe('alice');
  });

  it('prefers the captured authorDisplayName over the current user displayName', async () => {
    const t = setupConvexTest();
    const aliceId = await seedClerkUser(t, 'alice');
    const { poemIds } = await seedRoom(t, { userId: aliceId });
    await seedLine(t, {
      poemId: poemIds[0],
      authorUserId: aliceId,
      text: 'Hello',
      authorDisplayName: 'Alice Pen',
    });

    const result = await asUser(t, 'alice').query(api.poems.getPoemDetail, {
      poemId: poemIds[0],
    });
    expect(result?.lines[0].authorName).toBe('Alice Pen');
  });

  it('returns "Unknown" for deleted authors', async () => {
    const t = setupConvexTest();
    const aliceId = await seedClerkUser(t, 'alice');
    const ghostId = await t.run((ctx) =>
      ctx.db.insert('users', {
        displayName: 'Ghost',
        kind: 'human',
        createdAt: 0,
      })
    );
    const { poemIds } = await seedRoom(t, { userId: aliceId });
    await seedLine(t, {
      poemId: poemIds[0],
      authorUserId: ghostId,
      text: 'Vanished',
    });
    // Delete the ghost user.
    await t.run((ctx) => ctx.db.delete(ghostId));

    const result = await asUser(t, 'alice').query(api.poems.getPoemDetail, {
      poemId: poemIds[0],
    });
    expect(result?.lines[0].authorName).toBe('Unknown');
  });

  it('marks AI-authored lines with isBot: true', async () => {
    const t = setupConvexTest();
    const aliceId = await seedClerkUser(t, 'alice');
    const aiId = await t.run((ctx) =>
      ctx.db.insert('users', {
        displayName: 'Gemini',
        kind: 'AI',
        createdAt: 0,
      })
    );
    const { poemIds } = await seedRoom(t, { userId: aliceId });
    await seedLine(t, {
      poemId: poemIds[0],
      authorUserId: aiId,
      text: 'An AI line',
    });

    const result = await asUser(t, 'alice').query(api.poems.getPoemDetail, {
      poemId: poemIds[0],
    });
    expect(result?.lines[0].isBot).toBe(true);
  });

  it('returns poem document alongside lines', async () => {
    const t = setupConvexTest();
    const aliceId = await seedClerkUser(t, 'alice');
    const { poemIds } = await seedRoom(t, { userId: aliceId });
    await seedLine(t, {
      poemId: poemIds[0],
      authorUserId: aliceId,
      text: 'Only line',
    });

    const result = await asUser(t, 'alice').query(api.poems.getPoemDetail, {
      poemId: poemIds[0],
    });
    expect(result?.poem._id).toBe(poemIds[0]);
  });
});

// ---------------------------------------------------------------------------
// getMyPoems
// ---------------------------------------------------------------------------

describe('getMyPoems', () => {
  it('returns empty array when no Clerk identity is present', async () => {
    const t = setupConvexTest();
    const result = await t.query(api.poems.getMyPoems, {});
    expect(result).toEqual([]);
  });

  it('returns empty array when authenticated user has no user row', async () => {
    const t = setupConvexTest();
    const result = await t
      .withIdentity({ subject: 'clerk_nobody' })
      .query(api.poems.getMyPoems, {});
    expect(result).toEqual([]);
  });

  it('returns empty array when the user has not written any lines', async () => {
    const t = setupConvexTest();
    await seedClerkUser(t, 'alice');
    const result = await asUser(t, 'alice').query(api.poems.getMyPoems, {});
    expect(result).toEqual([]);
  });

  it('returns only poems the user contributed to (deduplicating by poem)', async () => {
    const t = setupConvexTest();
    const aliceId = await seedClerkUser(t, 'alice');
    const { poemIds } = await seedRoom(t, {
      userId: aliceId,
      poemCount: 2,
    });

    // Alice wrote two lines in poem 0 and one line in poem 1.
    await seedLine(t, {
      poemId: poemIds[0],
      authorUserId: aliceId,
      indexInPoem: 0,
      text: 'First in poem 0',
    });
    await seedLine(t, {
      poemId: poemIds[0],
      authorUserId: aliceId,
      indexInPoem: 1,
      text: 'Second in poem 0',
    });
    await seedLine(t, {
      poemId: poemIds[1],
      authorUserId: aliceId,
      indexInPoem: 0,
      text: 'First in poem 1',
    });

    const result = await asUser(t, 'alice').query(api.poems.getMyPoems, {});
    expect(result).toHaveLength(2);
    const ids = result.map((p: { _id: Id<'poems'> }) => p._id);
    expect(ids).toContain(poemIds[0]);
    expect(ids).toContain(poemIds[1]);
  });

  it('sorts poems by createdAt descending', async () => {
    const t = setupConvexTest();
    const aliceId = await seedClerkUser(t, 'alice');
    const { gameId, roomId } = await seedRoom(t, {
      userId: aliceId,
      poemCount: 0,
    });
    // Insert poems with different createdAt values.
    const { poem1, poem2, poem3 } = await t.run(async (ctx) => {
      const p1 = await ctx.db.insert('poems', {
        roomId,
        gameId,
        indexInRoom: 0,
        createdAt: 1000,
      });
      const p2 = await ctx.db.insert('poems', {
        roomId,
        gameId,
        indexInRoom: 1,
        createdAt: 3000,
      });
      const p3 = await ctx.db.insert('poems', {
        roomId,
        gameId,
        indexInRoom: 2,
        createdAt: 2000,
      });
      return { poem1: p1, poem2: p2, poem3: p3 };
    });

    await seedLine(t, { poemId: poem1, authorUserId: aliceId, indexInPoem: 0 });
    await seedLine(t, { poemId: poem2, authorUserId: aliceId, indexInPoem: 0 });
    await seedLine(t, { poemId: poem3, authorUserId: aliceId, indexInPoem: 0 });

    const result = await asUser(t, 'alice').query(api.poems.getMyPoems, {});
    expect(result.map((p: { _id: Id<'poems'> }) => p._id)).toEqual([
      poem2,
      poem3,
      poem1,
    ]);
  });

  it('windows personal history by explicit limit', async () => {
    const t = setupConvexTest();
    const aliceId = await seedClerkUser(t, 'alice');
    const { gameId, roomId } = await seedRoom(t, {
      userId: aliceId,
      poemCount: 0,
    });

    const poemIds = await t.run(async (ctx) => {
      const ids: Id<'poems'>[] = [];
      for (let i = 0; i < 4; i++) {
        ids.push(
          await ctx.db.insert('poems', {
            roomId,
            gameId,
            indexInRoom: i,
            createdAt: 1000 + i,
          })
        );
      }
      return ids;
    });

    for (const [index, poemId] of poemIds.entries()) {
      await seedLine(t, {
        poemId,
        authorUserId: aliceId,
        indexInPoem: 0,
        text: `Poem ${index}`,
      });
    }

    const result = await asUser(t, 'alice').query(api.poems.getMyPoems, {
      limit: 2,
    });

    expect(result.map((poem: { _id: Id<'poems'> }) => poem._id)).toEqual([
      poemIds[3],
      poemIds[2],
    ]);
  });

  it('includes roomDate from the room record', async () => {
    const t = setupConvexTest();
    const aliceId = await seedClerkUser(t, 'alice');
    // Seed with createdAt = 500 on the room (set inside t.run).
    const roomId = await t.run((ctx) =>
      ctx.db.insert('rooms', {
        code: 'ABCD',
        hostUserId: aliceId,
        status: 'COMPLETED',
        createdAt: 500,
      })
    );
    await t.run((ctx) =>
      ctx.db.insert('roomPlayers', {
        roomId,
        userId: aliceId,
        displayName: 'Alice',
        joinedAt: 0,
      })
    );
    const gameId = await t.run((ctx) =>
      ctx.db.insert('games', {
        roomId,
        status: 'COMPLETED',
        cycle: 1,
        currentRound: 0,
        assignmentMatrix: [[aliceId]],
        createdAt: 0,
      })
    );
    const poemId = await t.run((ctx) =>
      ctx.db.insert('poems', {
        roomId,
        gameId,
        indexInRoom: 0,
        createdAt: 1000,
      })
    );
    await seedLine(t, { poemId, authorUserId: aliceId, text: 'One line' });

    const result = await asUser(t, 'alice').query(api.poems.getMyPoems, {});
    expect(result).toHaveLength(1);
    expect(result[0].roomDate).toBe(500);
  });

  it('includes a first-line preview', async () => {
    const t = setupConvexTest();
    const aliceId = await seedClerkUser(t, 'alice');
    const { poemIds } = await seedRoom(t, { userId: aliceId, poemCount: 1 });
    await seedLine(t, {
      poemId: poemIds[0],
      authorUserId: aliceId,
      text: 'Opening verse',
    });

    const result = await asUser(t, 'alice').query(api.poems.getMyPoems, {});
    expect(result[0].preview).toBe('Opening verse');
  });

  it('uses "..." preview when poem has no first line', async () => {
    const t = setupConvexTest();
    const aliceId = await seedClerkUser(t, 'alice');
    const { poemIds } = await seedRoom(t, { userId: aliceId, poemCount: 1 });
    // Only a second line — no line at index 0.
    await seedLine(t, {
      poemId: poemIds[0],
      authorUserId: aliceId,
      indexInPoem: 1,
      text: 'Not the first',
    });

    const result = await asUser(t, 'alice').query(api.poems.getMyPoems, {});
    expect(result[0].preview).toBe('...');
  });

  it('handles poems across multiple rooms with correct roomDate per poem', async () => {
    const t = setupConvexTest();
    const aliceId = await seedClerkUser(t, 'alice');

    const room1 = await t.run((ctx) =>
      ctx.db.insert('rooms', {
        code: 'AAA1',
        hostUserId: aliceId,
        status: 'COMPLETED',
        createdAt: 100,
      })
    );
    const room2 = await t.run((ctx) =>
      ctx.db.insert('rooms', {
        code: 'BBB2',
        hostUserId: aliceId,
        status: 'COMPLETED',
        createdAt: 200,
      })
    );
    await t.run(async (ctx) => {
      await ctx.db.insert('roomPlayers', {
        roomId: room1,
        userId: aliceId,
        displayName: 'Alice',
        joinedAt: 0,
      });
      await ctx.db.insert('roomPlayers', {
        roomId: room2,
        userId: aliceId,
        displayName: 'Alice',
        joinedAt: 0,
      });
    });

    const game1 = await t.run((ctx) =>
      ctx.db.insert('games', {
        roomId: room1,
        status: 'COMPLETED',
        cycle: 1,
        currentRound: 0,
        assignmentMatrix: [],
        createdAt: 0,
      })
    );
    const game2 = await t.run((ctx) =>
      ctx.db.insert('games', {
        roomId: room2,
        status: 'COMPLETED',
        cycle: 1,
        currentRound: 0,
        assignmentMatrix: [],
        createdAt: 0,
      })
    );

    const poem1 = await t.run((ctx) =>
      ctx.db.insert('poems', {
        roomId: room1,
        gameId: game1,
        indexInRoom: 0,
        createdAt: 1000,
      })
    );
    const poem2 = await t.run((ctx) =>
      ctx.db.insert('poems', {
        roomId: room2,
        gameId: game2,
        indexInRoom: 0,
        createdAt: 2000,
      })
    );

    await seedLine(t, {
      poemId: poem1,
      authorUserId: aliceId,
      text: 'Room one',
    });
    await seedLine(t, {
      poemId: poem2,
      authorUserId: aliceId,
      text: 'Room two',
    });

    const result = await asUser(t, 'alice').query(api.poems.getMyPoems, {});
    expect(result).toHaveLength(2);
    // Sorted desc: poem2 (createdAt 2000) first.
    const byId = Object.fromEntries(result.map((p) => [p._id, p.roomDate]));
    expect(byId[poem1]).toBe(100);
    expect(byId[poem2]).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// getPublicPoemPreview
// ---------------------------------------------------------------------------

describe('getPublicPoemPreview', () => {
  it('returns null when the poem does not exist', async () => {
    const t = setupConvexTest();
    const aliceId = await seedClerkUser(t, 'alice');
    const { poemIds } = await seedRoom(t, { userId: aliceId });
    await t.run((ctx) => ctx.db.delete(poemIds[0]));

    const result = await t.query(api.poems.getPublicPoemPreview, {
      poemId: poemIds[0],
    });
    expect(result).toBeNull();
  });

  it('returns null when publicShareEnabled is false', async () => {
    const t = setupConvexTest();
    const aliceId = await seedClerkUser(t, 'alice');
    const { poemIds } = await seedRoom(t, {
      userId: aliceId,
      publicShareEnabled: false,
    });

    const result = await t.query(api.poems.getPublicPoemPreview, {
      poemId: poemIds[0],
    });
    expect(result).toBeNull();
  });

  it('returns null when publicShareEnabled is absent', async () => {
    const t = setupConvexTest();
    const aliceId = await seedClerkUser(t, 'alice');
    // seedRoom does not set publicShareEnabled when left undefined.
    const { poemIds } = await seedRoom(t, { userId: aliceId });

    const result = await t.query(api.poems.getPublicPoemPreview, {
      poemId: poemIds[0],
    });
    expect(result).toBeNull();
  });

  it('returns preview with first 3 lines, poetCount, and poemNumber', async () => {
    const t = setupConvexTest();
    const aliceId = await seedClerkUser(t, 'alice');
    const bobId = await seedClerkUser(t, 'bob');
    const charlieId = await seedClerkUser(t, 'charlie');
    const { poemIds } = await seedRoom(t, {
      userId: aliceId,
      publicShareEnabled: true,
    });
    // 4 lines — only first 3 should appear in preview.
    await seedLine(t, {
      poemId: poemIds[0],
      authorUserId: aliceId,
      indexInPoem: 0,
      text: 'Line 1',
    });
    await seedLine(t, {
      poemId: poemIds[0],
      authorUserId: bobId,
      indexInPoem: 1,
      text: 'Line 2',
    });
    await seedLine(t, {
      poemId: poemIds[0],
      authorUserId: charlieId,
      indexInPoem: 2,
      text: 'Line 3',
    });
    await seedLine(t, {
      poemId: poemIds[0],
      authorUserId: aliceId,
      indexInPoem: 3,
      text: 'Line 4',
    });

    const result = await t.query(api.poems.getPublicPoemPreview, {
      poemId: poemIds[0],
    });

    expect(result).toEqual({
      lines: ['Line 1', 'Line 2', 'Line 3'],
      poetCount: 3, // alice, bob, charlie
      poemNumber: 1, // indexInRoom 0 + 1
    });
  });

  it('counts unique poets correctly when the same author writes multiple lines', async () => {
    const t = setupConvexTest();
    const aliceId = await seedClerkUser(t, 'alice');
    const bobId = await seedClerkUser(t, 'bob');
    const { poemIds } = await seedRoom(t, {
      userId: aliceId,
      publicShareEnabled: true,
    });
    // alice writes lines 0 and 2; bob writes line 1.
    await seedLine(t, {
      poemId: poemIds[0],
      authorUserId: aliceId,
      indexInPoem: 0,
      text: 'Alice start',
    });
    await seedLine(t, {
      poemId: poemIds[0],
      authorUserId: bobId,
      indexInPoem: 1,
      text: 'Bob middle',
    });
    await seedLine(t, {
      poemId: poemIds[0],
      authorUserId: aliceId,
      indexInPoem: 2,
      text: 'Alice again',
    });

    const result = await t.query(api.poems.getPublicPoemPreview, {
      poemId: poemIds[0],
    });
    expect(result?.poetCount).toBe(2);
  });

  it('returns poemNumber as indexInRoom + 1', async () => {
    const t = setupConvexTest();
    const aliceId = await seedClerkUser(t, 'alice');
    // Poem with indexInRoom = 4 (poem number 5).
    const { gameId, roomId } = await seedRoom(t, {
      userId: aliceId,
      poemCount: 0,
      publicShareEnabled: true,
    });
    const poemId = await t.run((ctx) =>
      ctx.db.insert('poems', {
        roomId,
        gameId,
        indexInRoom: 4,
        createdAt: 0,
        publicShareEnabled: true,
      })
    );
    await seedLine(t, { poemId, authorUserId: aliceId, text: 'Only line' });

    const result = await t.query(api.poems.getPublicPoemPreview, {
      poemId,
    });
    expect(result?.poemNumber).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// getPublicPoemFull
// ---------------------------------------------------------------------------

describe('getPublicPoemFull', () => {
  it('returns null when the poem does not exist', async () => {
    const t = setupConvexTest();
    const aliceId = await seedClerkUser(t, 'alice');
    const { poemIds } = await seedRoom(t, { userId: aliceId });
    await t.run((ctx) => ctx.db.delete(poemIds[0]));

    const result = await t.query(api.poems.getPublicPoemFull, {
      poemId: poemIds[0],
    });
    expect(result).toBeNull();
  });

  it('returns null when publicShareEnabled is false', async () => {
    const t = setupConvexTest();
    const aliceId = await seedClerkUser(t, 'alice');
    const { poemIds } = await seedRoom(t, {
      userId: aliceId,
      publicShareEnabled: false,
    });

    const result = await t.query(api.poems.getPublicPoemFull, {
      poemId: poemIds[0],
    });
    expect(result).toBeNull();
  });

  it('returns null when publicShareEnabled is absent', async () => {
    const t = setupConvexTest();
    const aliceId = await seedClerkUser(t, 'alice');
    const { poemIds } = await seedRoom(t, { userId: aliceId });

    const result = await t.query(api.poems.getPublicPoemFull, {
      poemId: poemIds[0],
    });
    expect(result).toBeNull();
  });

  it('returns full poem and all lines with author names in order', async () => {
    const t = setupConvexTest();
    const aliceId = await seedClerkUser(t, 'alice');
    const bobId = await seedClerkUser(t, 'bob');
    const { poemIds } = await seedRoom(t, {
      userId: aliceId,
      publicShareEnabled: true,
    });

    // Lines inserted out of order.
    await seedLine(t, {
      poemId: poemIds[0],
      authorUserId: bobId,
      indexInPoem: 1,
      text: 'Second line',
    });
    await seedLine(t, {
      poemId: poemIds[0],
      authorUserId: aliceId,
      indexInPoem: 0,
      text: 'First line',
    });
    await seedLine(t, {
      poemId: poemIds[0],
      authorUserId: aliceId,
      indexInPoem: 2,
      text: 'Third line',
    });

    const result = await t.query(api.poems.getPublicPoemFull, {
      poemId: poemIds[0],
    });

    expect(result).not.toBeNull();
    expect(result?.poem._id).toBe(poemIds[0]);
    expect(result?.lines).toHaveLength(3);
    expect(result?.lines[0]).toMatchObject({
      text: 'First line',
      authorName: 'alice',
    });
    expect(result?.lines[1]).toMatchObject({
      text: 'Second line',
      authorName: 'bob',
    });
    expect(result?.lines[2]).toMatchObject({
      text: 'Third line',
      authorName: 'alice',
    });

    const publicLines = result!.lines as Array<Record<string, unknown>>;
    expect(publicLines[0].authorKey).toBe(publicLines[2].authorKey);
    expect(publicLines[0].authorKey).not.toBe(publicLines[1].authorKey);
    expect(Object.keys(publicLines[0]).sort()).toEqual([
      '_id',
      'authorKey',
      'authorName',
      'createdAt',
      'indexInPoem',
      'isBot',
      'poemId',
      'text',
      'wordCount',
    ]);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('authorUserId');
    expect(serialized).not.toContain('clerkUserId');
    expect(serialized).not.toContain('guestId');
    expect(serialized).not.toContain('authorStableId');
  });

  it('uses "Unknown" for deleted authors', async () => {
    const t = setupConvexTest();
    const aliceId = await seedClerkUser(t, 'alice');
    const ghostId = await t.run((ctx) =>
      ctx.db.insert('users', {
        displayName: 'Ghost',
        kind: 'human',
        createdAt: 0,
      })
    );
    const { poemIds } = await seedRoom(t, {
      userId: aliceId,
      publicShareEnabled: true,
    });
    await seedLine(t, {
      poemId: poemIds[0],
      authorUserId: ghostId,
      text: 'Vanished line',
    });
    await t.run((ctx) => ctx.db.delete(ghostId));

    const result = await t.query(api.poems.getPublicPoemFull, {
      poemId: poemIds[0],
    });
    expect(result?.lines[0].authorName).toBe('Unknown');
  });

  it('prefers captured authorDisplayName over current displayName', async () => {
    const t = setupConvexTest();
    const aliceId = await seedClerkUser(t, 'alice');
    const { poemIds } = await seedRoom(t, {
      userId: aliceId,
      publicShareEnabled: true,
    });
    await seedLine(t, {
      poemId: poemIds[0],
      authorUserId: aliceId,
      text: 'Penned line',
      authorDisplayName: 'Alice Pen',
    });

    const result = await t.query(api.poems.getPublicPoemFull, {
      poemId: poemIds[0],
    });
    expect(result?.lines[0].authorName).toBe('Alice Pen');
  });

  it('marks AI-authored lines with isBot: true', async () => {
    const t = setupConvexTest();
    const aliceId = await seedClerkUser(t, 'alice');
    const aiId = await t.run((ctx) =>
      ctx.db.insert('users', {
        displayName: 'Muse',
        kind: 'AI',
        createdAt: 0,
      })
    );
    const { poemIds } = await seedRoom(t, {
      userId: aliceId,
      publicShareEnabled: true,
    });
    await seedLine(t, {
      poemId: poemIds[0],
      authorUserId: aiId,
      text: 'AI generated',
    });

    const result = await t.query(api.poems.getPublicPoemFull, {
      poemId: poemIds[0],
    });
    expect(result?.lines[0].isBot).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getPublicSessionRecap
// ---------------------------------------------------------------------------

describe('getPublicSessionRecap', () => {
  it('returns null when the room does not exist', async () => {
    const t = setupConvexTest();
    const result = await t.query(api.poems.getPublicSessionRecap, {
      roomCode: 'MISS',
    });
    expect(result).toBeNull();
  });

  it('returns null when the room has no completed game', async () => {
    const t = setupConvexTest();
    const aliceId = await seedClerkUser(t, 'alice');
    await seedRoom(t, {
      userId: aliceId,
      gameStatus: 'IN_PROGRESS',
      roomStatus: 'IN_PROGRESS',
    });

    const result = await t.query(api.poems.getPublicSessionRecap, {
      roomCode: 'ABCD',
    });
    expect(result).toBeNull();
  });

  it('returns null when publicRecapEnabled is false', async () => {
    const t = setupConvexTest();
    const aliceId = await seedClerkUser(t, 'alice');
    await seedRoom(t, {
      userId: aliceId,
      gameStatus: 'COMPLETED',
      roomStatus: 'COMPLETED',
      publicRecapEnabled: false,
      revealPoems: true,
    });

    const result = await t.query(api.poems.getPublicSessionRecap, {
      roomCode: 'ABCD',
    });
    expect(result).toBeNull();
  });

  it('returns null when publicRecapEnabled is absent', async () => {
    const t = setupConvexTest();
    const aliceId = await seedClerkUser(t, 'alice');
    await seedRoom(t, {
      userId: aliceId,
      gameStatus: 'COMPLETED',
      roomStatus: 'COMPLETED',
      revealPoems: true,
    });

    const result = await t.query(api.poems.getPublicSessionRecap, {
      roomCode: 'ABCD',
    });
    expect(result).toBeNull();
  });

  it('returns null when any poem in the game has not been revealed yet', async () => {
    const t = setupConvexTest();
    const aliceId = await seedClerkUser(t, 'alice');
    const { gameId, roomId } = await seedRoom(t, {
      userId: aliceId,
      gameStatus: 'COMPLETED',
      roomStatus: 'COMPLETED',
      publicRecapEnabled: true,
      poemCount: 1,
      revealPoems: true,
    });
    // Add a second unrevealed poem.
    await t.run((ctx) =>
      ctx.db.insert('poems', {
        roomId,
        gameId,
        indexInRoom: 1,
        createdAt: 2000,
        // No revealedAt — not yet revealed.
      })
    );

    const result = await t.query(api.poems.getPublicSessionRecap, {
      roomCode: 'ABCD',
    });
    expect(result).toBeNull();
  });

  it('returns session-level summary with poems sorted by indexInRoom', async () => {
    const t = setupConvexTest();
    const aliceId = await seedClerkUser(t, 'alice');
    const bobId = await seedClerkUser(t, 'bob');

    // Build room without the generic seedRoom player so we can control displayNames.
    const { gameId, roomId } = await seedRoom(t, {
      userId: aliceId,
      gameStatus: 'COMPLETED',
      roomStatus: 'COMPLETED',
      publicRecapEnabled: true,
      poemCount: 0,
      addRoomPlayer: false,
    });
    // Add both players with explicit display names.
    await t.run(async (ctx) => {
      await ctx.db.insert('roomPlayers', {
        roomId,
        userId: aliceId,
        displayName: 'Alice',
        joinedAt: 0,
      });
      await ctx.db.insert('roomPlayers', {
        roomId,
        userId: bobId,
        displayName: 'Bob',
        joinedAt: 0,
      });
    });

    // Two poems — insert poem2 first to verify sort by indexInRoom.
    const poem2Id = await t.run((ctx) =>
      ctx.db.insert('poems', {
        roomId,
        gameId,
        indexInRoom: 1,
        createdAt: 1500,
        revealedAt: 9001,
        assignedReaderId: bobId,
      })
    );
    const poem1Id = await t.run((ctx) =>
      ctx.db.insert('poems', {
        roomId,
        gameId,
        indexInRoom: 0,
        createdAt: 1000,
        revealedAt: 9000,
        assignedReaderId: aliceId,
      })
    );

    await seedLine(t, {
      poemId: poem1Id,
      authorUserId: aliceId,
      indexInPoem: 0,
      text: 'Poem one opening',
      authorDisplayName: 'Alice Pen',
    });
    await seedLine(t, {
      poemId: poem2Id,
      authorUserId: bobId,
      indexInPoem: 0,
      text: 'Poem two opening',
    });

    const result = await t.query(api.poems.getPublicSessionRecap, {
      roomCode: 'ABCD',
    });

    expect(result).toMatchObject({
      roomCode: 'ABCD',
      cycle: 1,
      poemCount: 2,
      playerCount: 2,
    });
    // Poems must be in indexInRoom order.
    expect(result?.poems[0]._id).toBe(poem1Id);
    expect(result?.poems[1]._id).toBe(poem2Id);
    expect(result?.poems[0]).toMatchObject({
      preview: 'Poem one opening',
      readerName: 'Alice',
      starterName: 'Alice Pen',
      poetCount: 1,
    });
  });

  it('derives starterName from the first-line authorDisplayName not mutable room seats', async () => {
    const t = setupConvexTest();
    const readerUserId = await t.run((ctx) =>
      ctx.db.insert('users', {
        displayName: 'Reader',
        kind: 'human',
        clerkUserId: 'clerk_reader',
        createdAt: 0,
      })
    );
    const starterUserId = await t.run((ctx) =>
      ctx.db.insert('users', {
        displayName: 'Starter',
        kind: 'human',
        clerkUserId: 'clerk_starter',
        createdAt: 0,
      })
    );

    const roomId = await t.run((ctx) =>
      ctx.db.insert('rooms', {
        code: 'ABCD',
        hostUserId: readerUserId,
        status: 'COMPLETED',
        createdAt: 0,
      })
    );
    await t.run(async (ctx) => {
      await ctx.db.insert('roomPlayers', {
        roomId,
        userId: readerUserId,
        displayName: 'Reader',
        joinedAt: 0,
      });
      await ctx.db.insert('roomPlayers', {
        roomId,
        userId: starterUserId,
        displayName: 'Starter',
        joinedAt: 0,
      });
    });
    const gameId = await t.run((ctx) =>
      ctx.db.insert('games', {
        roomId,
        status: 'COMPLETED',
        cycle: 1,
        currentRound: 0,
        assignmentMatrix: [],
        createdAt: 0,
        publicRecapEnabled: true,
      })
    );
    const poemId = await t.run((ctx) =>
      ctx.db.insert('poems', {
        roomId,
        gameId,
        indexInRoom: 0,
        createdAt: 0,
        revealedAt: 9000,
        assignedReaderId: readerUserId,
      })
    );
    // Starter wrote the first line, captured by authorDisplayName.
    await seedLine(t, {
      poemId,
      authorUserId: starterUserId,
      indexInPoem: 0,
      text: 'Opening line',
      authorDisplayName: 'Starter',
    });

    const result = await t.query(api.poems.getPublicSessionRecap, {
      roomCode: 'ABCD',
    });
    expect(result?.poems[0]).toMatchObject({
      readerName: 'Reader',
      starterName: 'Starter',
    });
  });

  it('marks AI authors with isBot: true and falls back to Unknown for deleted users', async () => {
    const t = setupConvexTest();
    const aliceId = await seedClerkUser(t, 'alice');
    const aiId = await t.run((ctx) =>
      ctx.db.insert('users', {
        displayName: 'Muse',
        kind: 'AI',
        createdAt: 0,
      })
    );
    const ghostId = await t.run((ctx) =>
      ctx.db.insert('users', {
        displayName: 'Ghost',
        kind: 'human',
        createdAt: 0,
      })
    );

    const { gameId, roomId } = await seedRoom(t, {
      userId: aliceId,
      gameStatus: 'COMPLETED',
      roomStatus: 'COMPLETED',
      publicRecapEnabled: true,
      poemCount: 0,
    });
    const poemId = await t.run((ctx) =>
      ctx.db.insert('poems', {
        roomId,
        gameId,
        indexInRoom: 0,
        createdAt: 0,
        revealedAt: 9000,
        assignedReaderId: aliceId,
      })
    );

    await seedLine(t, {
      poemId,
      authorUserId: ghostId,
      indexInPoem: 0,
      text: 'Mystery line',
    });
    await seedLine(t, {
      poemId,
      authorUserId: aiId,
      indexInPoem: 1,
      text: 'AI line',
    });
    // Delete the ghost user so its author lookup returns null.
    await t.run((ctx) => ctx.db.delete(ghostId));

    const result = await t.query(api.poems.getPublicSessionRecap, {
      roomCode: 'ABCD',
    });

    expect(result?.poems[0].lines).toEqual([
      { text: 'Mystery line', authorName: 'Unknown', isBot: false },
      { text: 'AI line', authorName: 'Muse', isBot: true },
    ]);
  });

  it('falls back cleanly when recap names and lines are missing', async () => {
    const t = setupConvexTest();
    const aliceId = await seedClerkUser(t, 'alice');
    const missingReaderId = await t.run((ctx) =>
      ctx.db.insert('users', {
        displayName: 'Missing Reader',
        kind: 'human',
        createdAt: 0,
      })
    );

    const { gameId, roomId } = await seedRoom(t, {
      userId: aliceId,
      gameStatus: 'COMPLETED',
      roomStatus: 'COMPLETED',
      publicRecapEnabled: true,
      poemCount: 0,
    });
    const poemId = await t.run((ctx) =>
      ctx.db.insert('poems', {
        roomId,
        gameId,
        indexInRoom: 0,
        createdAt: 0,
        revealedAt: 9000,
        assignedReaderId: missingReaderId,
      })
    );
    // Delete the reader user so players lookup misses them.
    await t.run((ctx) => ctx.db.delete(missingReaderId));
    // No lines inserted for this poem.

    const result = await t.query(api.poems.getPublicSessionRecap, {
      roomCode: 'ABCD',
    });

    expect(result?.poems[0]).toMatchObject({
      preview: '',
      readerName: 'Unknown',
      starterName: 'Unknown',
      poetCount: 0,
      lines: [],
    });
    expect(result?.poems[0]._id).toBe(poemId);
  });

  it('ignores lines without authorUserId when building the author set', async () => {
    const t = setupConvexTest();
    const aliceId = await seedClerkUser(t, 'alice');

    const { gameId, roomId } = await seedRoom(t, {
      userId: aliceId,
      gameStatus: 'COMPLETED',
      roomStatus: 'COMPLETED',
      publicRecapEnabled: true,
      poemCount: 0,
    });
    const poemId = await t.run((ctx) =>
      ctx.db.insert('poems', {
        roomId,
        gameId,
        indexInRoom: 0,
        createdAt: 0,
        revealedAt: 9000,
        assignedReaderId: aliceId,
      })
    );
    // Insert a line; the filter in getPublicSessionRecap excludes undefined
    // authorUserId from the author lookup set, so poetCount stays 1 for the
    // real author but 0 for legacy-undefined lines.
    // (Legacy behavior: line with a valid authorUserId but no display name.)
    await seedLine(t, {
      poemId,
      authorUserId: aliceId,
      indexInPoem: 0,
      text: 'Legacy line',
    });

    const result = await t.query(api.poems.getPublicSessionRecap, {
      roomCode: 'ABCD',
    });
    // The author IS alice; poetCount is 1.
    expect(result?.poems[0].poetCount).toBe(1);
    expect(result?.poems[0].lines[0].authorName).toBe('alice');
  });
});
