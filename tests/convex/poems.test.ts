import { describe, it, expect } from 'vitest';
import { ConvexError } from 'convex/values';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { setupConvexTest } from '../helpers/convexTest';
import { type T, asUser, seedClerkUser, seedLine } from '../helpers/convexSeed';
import { getDefaultAvatarId } from '../../lib/avatars';
import { WORD_COUNTS } from '../../convex/lib/gameRules';

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
interface PoemQueryGameSeedDocument {
  roomId: Id<'rooms'>;
  status: 'IN_PROGRESS' | 'COMPLETED';
  cycle: number;
  currentRound: number;
  assignmentMatrix: Id<'users'>[][];
  createdAt: number;
  publicRecapEnabled?: boolean;
}

interface PoemQueryPoemSeedDocument {
  roomId: Id<'rooms'>;
  gameId: Id<'games'>;
  indexInRoom: number;
  createdAt: number;
  revealedAt?: number;
  publicShareEnabled?: boolean;
}

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

    const gameDoc: PoemQueryGameSeedDocument = {
      roomId,
      status: gameStatus,
      cycle: 1,
      currentRound: 0,
      assignmentMatrix: [[userId]],
      createdAt: 0,
    };
    if (publicRecapEnabled !== undefined) {
      gameDoc.publicRecapEnabled = publicRecapEnabled;
    }
    const gameId = await ctx.db.insert('games', gameDoc);

    const poemIds: Id<'poems'>[] = [];
    for (let i = 0; i < poemCount; i++) {
      const poemDoc: PoemQueryPoemSeedDocument = {
        roomId,
        gameId,
        indexInRoom: i,
        createdAt: i * 1000 + 1000,
      };
      if (revealPoems) {
        poemDoc.revealedAt = 9000 + i;
      }
      if (publicShareEnabled !== undefined) {
        poemDoc.publicShareEnabled = publicShareEnabled;
      }
      poemIds.push(await ctx.db.insert('poems', poemDoc));
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

  it('never returns previews from a partial in-progress game', async () => {
    const t = setupConvexTest();
    const aliceId = await seedClerkUser(t, 'alice');
    const { poemIds } = await seedRoom(t, {
      userId: aliceId,
      poemCount: 1,
      gameStatus: 'IN_PROGRESS',
      roomStatus: 'IN_PROGRESS',
    });
    await seedLine(t, {
      poemId: poemIds[0],
      authorUserId: aliceId,
      text: 'Private partial line',
    });

    const result = await asUser(t, 'alice').query(api.poems.getPoemsForRoom, {
      roomCode: 'ABCD',
    });
    expect(result).toEqual([]);
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

  it('previews the first retained line without hiding an empty companion poem', async () => {
    const t = setupConvexTest();
    const aliceId = await seedClerkUser(t, 'alice');
    const { poemIds } = await seedRoom(t, { userId: aliceId, poemCount: 2 });
    await seedLine(t, {
      poemId: poemIds[0],
      authorUserId: aliceId,
      indexInPoem: 2,
      text: 'Later retained line',
    });
    await seedLine(t, {
      poemId: poemIds[0],
      authorUserId: aliceId,
      indexInPoem: 1,
      text: 'First retained line',
    });

    const result = await asUser(t, 'alice').query(api.poems.getPoemsForRoom, {
      roomCode: 'ABCD',
    });
    expect(result).toMatchObject([
      { _id: poemIds[0], preview: 'First retained line' },
      { _id: poemIds[1], preview: '...' },
    ]);
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
});

describe('native completed-game artifact access', () => {
  it('keeps later-game artifacts private while retained writers finish closed archives', async () => {
    const t = setupConvexTest();
    const departedId = await seedClerkUser(t, 'departed');
    const hostId = await seedClerkUser(t, 'host');
    await seedClerkUser(t, 'writer');
    await seedClerkUser(t, 'spectator');
    const clients = {
      host: asUser(t, 'host'),
      writer: asUser(t, 'writer'),
      departed: asUser(t, 'departed'),
      spectator: asUser(t, 'spectator'),
    };
    const { code, roomId } = await clients.host.mutation(api.rooms.createRoom, {
      displayName: 'Host',
    });
    for (const name of ['writer', 'departed'] as const) {
      await clients[name].mutation(api.rooms.joinRoom, {
        code,
        displayName: name,
      });
    }

    async function finishGame(
      writers: readonly ('host' | 'writer' | 'departed')[],
      word: string
    ) {
      for (const [lineIndex, wordCount] of WORD_COUNTS.entries()) {
        for (const name of writers) {
          const assignment = await clients[name].query(
            api.game.getCurrentAssignment,
            { roomCode: code }
          );
          if (!assignment) throw new Error(`Missing assignment for ${name}`);
          await clients[name].mutation(api.game.submitLine, {
            poemId: assignment.poemId,
            lineIndex,
            text: Array(wordCount).fill(word).join(' '),
          });
        }
      }
    }

    await clients.host.mutation(api.game.startGame, { code });
    await finishGame(['host', 'writer', 'departed'], 'earlier');
    const earlierPoems = await clients.departed.query(
      api.poems.getPoemsForRoom,
      {
        roomCode: code,
      }
    );
    expect(earlierPoems.map((poem) => poem.preview)).toEqual([
      'earlier',
      'earlier',
      'earlier',
    ]);

    await clients.host.mutation(api.game.startNewCycle, { roomCode: code });
    await clients.departed.mutation(api.rooms.leaveLobby, { roomCode: code });
    const departedProfile = await t.run((ctx) =>
      ctx.db
        .query('roomPlayers')
        .withIndex('by_room_user', (q) =>
          q.eq('roomId', roomId).eq('userId', departedId)
        )
        .unique()
    );
    expect(departedProfile?.playerId).toBeDefined();

    await clients.host.mutation(api.game.startGame, { code });
    await clients.spectator.mutation(api.rooms.joinRoom, {
      code,
      displayName: 'Spectator',
    });
    await finishGame(['host', 'writer'], 'unrevealed');
    const poems = await clients.host.query(api.poems.getPoemsForRoom, {
      roomCode: code,
    });
    expect(poems.map((poem) => poem.preview)).toEqual([
      'unrevealed',
      'unrevealed',
    ]);
    const poemId = poems[0]._id;
    const game = await t.run((ctx) => ctx.db.get(poems[0].gameId));
    expect(game?.matchId).toBeDefined();
    expect(game?.cycle).toBe(2);

    for (const viewer of [clients.departed, clients.spectator]) {
      expect(
        await viewer.query(api.poems.getPoemDetail, { poemId })
      ).toBeNull();
      expect(
        await viewer.query(api.poems.getPoemsForRoom, { roomCode: code })
      ).toEqual([]);
      expect(
        await viewer.query(api.favorites.getSessionFavorites, {
          roomCode: code,
        })
      ).toBeNull();
      await expect(
        viewer.mutation(api.favorites.toggleFavorite, { poemId })
      ).rejects.toBeInstanceOf(ConvexError);
    }

    await clients.writer.mutation(api.favorites.toggleFavorite, { poemId });
    await clients.host.mutation(api.rooms.closeRoom, { roomCode: code });
    const closedPresence = await t.run(async (ctx) => ({
      closedAt: (await ctx.db.get(roomId))?.closedAt,
      members: await ctx.db
        .query('roomMembers')
        .withIndex('by_room_seat', (q) => q.eq('roomId', roomId))
        .collect(),
    }));
    expect(closedPresence.closedAt).toBeDefined();
    expect(
      closedPresence.members.filter((member) => member.closedAt === undefined)
    ).toEqual([]);

    // The assigned host is gone; a retained non-host writer can read and reveal.
    const reading = await clients.writer.query(api.game.getRevealPhaseState, {
      roomCode: code,
    });
    expect(reading?.canContinueRoom).toBe(false);
    expect(
      reading?.myPoems.find((poem) => poem.assignedReaderId === hostId)
    ).toMatchObject({
      canReveal: true,
      isFallbackReader: true,
      lines: WORD_COUNTS.map((count) =>
        expect.objectContaining({
          text: Array(count).fill('unrevealed').join(' '),
        })
      ),
    });
    expect(reading?.myPoems.map((poem) => poem._id).sort()).toEqual(
      poems.map((poem) => poem._id).sort()
    );
    for (const viewer of [clients.departed, clients.spectator]) {
      expect(
        await viewer.query(api.game.getRevealPhaseState, { roomCode: code })
      ).toBeNull();
      await expect(
        viewer.mutation(api.game.revealPoem, { poemId })
      ).rejects.toBeInstanceOf(ConvexError);
    }

    for (const poem of poems) {
      await expect(
        clients.writer.mutation(api.game.revealPoem, { poemId: poem._id })
      ).resolves.toEqual({ revealed: true });
    }
    expect(
      await clients.writer.query(api.game.getRevealPhaseState, {
        roomCode: code,
      })
    ).toMatchObject({ allRevealed: true, canContinueRoom: false });
    for (const viewer of [clients.writer, clients.spectator]) {
      await viewer.mutation(api.presence.heartbeat, { roomCode: code });
    }
    const presenceAfterReading = await t.run(async (ctx) => ({
      closedAt: (await ctx.db.get(roomId))?.closedAt,
      members: await ctx.db
        .query('roomMembers')
        .withIndex('by_room_seat', (q) => q.eq('roomId', roomId))
        .collect(),
    }));
    expect(presenceAfterReading).toEqual(closedPresence);
    expect(
      await clients.spectator.query(api.rooms.getRoomState, { code })
    ).toBeNull();
    expect(
      await clients.writer.query(api.rooms.getRoomState, { code })
    ).toMatchObject({ room: { status: 'COMPLETED' }, players: [] });

    const archived = await clients.writer.query(api.poems.getPoemDetail, {
      poemId,
    });
    expect(archived?.lines.map((line) => line.text)).toEqual(
      WORD_COUNTS.map((count) => Array(count).fill('unrevealed').join(' '))
    );
    expect(
      (
        await clients.writer.query(api.poems.getPoemsForRoom, {
          roomCode: code,
        })
      )
        .map((poem) => poem._id)
        .sort()
    ).toEqual(poems.map((poem) => poem._id).sort());
    expect(
      await clients.writer.query(api.favorites.getMyFavorites, {})
    ).toMatchObject([{ _id: poemId, preview: 'unrevealed' }]);
    expect(
      await clients.writer.query(api.favorites.getSessionFavorites, {
        roomCode: code,
      })
    ).toMatchObject({ totalHearts: 1, leaderPoemId: poemId });
    expect(
      (
        await clients.departed.query(api.poems.getPoemDetail, {
          poemId: earlierPoems[0]._id,
        })
      )?.lines.map((line) => line.text)
    ).toEqual(
      WORD_COUNTS.map((count) => Array(count).fill('earlier').join(' '))
    );
    expect(
      (await clients.departed.query(api.poems.getMyPoems, {}))
        .map((poem) => poem._id)
        .sort()
    ).toEqual(earlierPoems.map((poem) => poem._id).sort());
    expect(await clients.spectator.query(api.poems.getMyPoems, {})).toEqual([]);

    const pending = await clients.host.mutation(
      api.shares.preparePublicPoemShare,
      { poemId }
    );
    const activation = { poemId, slug: pending.slug, nonce: pending.nonce };
    for (const viewer of [clients.departed, clients.spectator]) {
      expect(
        await viewer.query(api.poems.getPoemDetail, { poemId })
      ).toBeNull();
      await expect(
        viewer.mutation(api.shares.preparePublicPoemShare, { poemId })
      ).rejects.toBeInstanceOf(ConvexError);
      await expect(
        viewer.mutation(api.shares.activatePublicPoemShare, activation)
      ).rejects.toBeInstanceOf(ConvexError);
      await expect(
        viewer.mutation(api.shares.cancelPublicPoemShare, activation)
      ).rejects.toBeInstanceOf(ConvexError);
      await expect(
        viewer.mutation(api.shares.disablePublicPoemShare, { poemId })
      ).rejects.toBeInstanceOf(ConvexError);
      await expect(
        viewer.mutation(api.shares.enablePublicSessionRecapShare, {
          roomCode: code,
        })
      ).rejects.toBeInstanceOf(ConvexError);
      await expect(
        viewer.mutation(api.shares.disablePublicSessionRecapShare, {
          roomCode: code,
        })
      ).rejects.toBeInstanceOf(ConvexError);
    }

    await clients.host.mutation(api.shares.activatePublicPoemShare, activation);
    expect(
      (
        await t.query(api.poems.getPublicPoemFull, {
          poemId,
          shareSlug: pending.slug,
        })
      )?.lines.map((line) => line.text)
    ).toEqual(archived?.lines.map((line) => line.text));
    await clients.departed.mutation(api.favorites.toggleFavorite, { poemId });
    expect(
      await clients.departed.query(api.favorites.getMyFavorites, {})
    ).toMatchObject([{ _id: poemId, preview: 'unrevealed' }]);
    expect(
      await clients.departed.query(api.favorites.isFavorited, { poemId })
    ).toBe(true);

    await clients.host.mutation(api.shares.enablePublicSessionRecapShare, {
      roomCode: code,
    });
    const recap = await t.query(api.poems.getPublicSessionRecap, {
      roomCode: code,
    });
    expect(recap?.playerCount).toBe(2);
    expect(recap?.poems.map((poem) => poem.readerName).sort()).toEqual([
      'Host',
      'writer',
    ]);

    await clients.host.mutation(api.shares.disablePublicPoemShare, { poemId });
    await clients.host.mutation(api.shares.disablePublicSessionRecapShare, {
      roomCode: code,
    });
    expect(
      await clients.departed.query(api.favorites.getMyFavorites, {})
    ).toEqual([]);
    expect(
      await clients.departed.query(api.favorites.isFavorited, { poemId })
    ).toBe(false);
    await clients.departed.mutation(api.favorites.toggleFavorite, { poemId });
    expect(
      await clients.writer.query(api.favorites.isFavorited, { poemId })
    ).toBe(true);
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

  it('fills the limit with completed poems after skipping newer abandoned work', async () => {
    const t = setupConvexTest();
    const aliceId = await seedClerkUser(t, 'alicePrivatePartial');
    const completed = await seedRoom(t, {
      userId: aliceId,
      roomCode: 'CMP1',
    });
    const abandoned = await seedRoom(t, {
      userId: aliceId,
      roomCode: 'ABN1',
      gameStatus: 'IN_PROGRESS',
      roomStatus: 'IN_PROGRESS',
    });
    await t.run(async (ctx) => {
      await ctx.db.patch(abandoned.gameId, { status: 'ABANDONED' });
      await ctx.db.insert('lines', {
        poemId: completed.poemIds[0],
        indexInPoem: 0,
        text: 'Completed',
        wordCount: 1,
        authorUserId: aliceId,
        createdAt: 100,
      });
      await ctx.db.insert('lines', {
        poemId: abandoned.poemIds[0],
        indexInPoem: 0,
        text: 'Private',
        wordCount: 1,
        authorUserId: aliceId,
        createdAt: 200,
      });
    });

    const result = await asUser(t, 'alicePrivatePartial').query(
      api.poems.getMyPoems,
      { limit: 1 }
    );

    expect(result.map((poem) => poem._id)).toEqual([completed.poemIds[0]]);
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

    const publicLines = result!.lines;
    expect(publicLines[0].authorKey).toBe(publicLines[2].authorKey);
    expect(publicLines[0].authorKey).not.toBe(publicLines[1].authorKey);
    expect(Object.keys(publicLines[0]).sort()).toEqual([
      '_id',
      'authorKey',
      'authorName',
      'createdAt',
      'indexInPoem',
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

  it('returns sorted session poems with room avatars but no reader identities', async () => {
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
        avatarId: 'sunny',
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
      readerAvatarId: 'sunny',
      starterName: 'Alice Pen',
      poetCount: 1,
    });
    expect(result?.poems[1].readerAvatarId).toBe(
      getDefaultAvatarId('clerk_bob')
    );
    const publicPayload = JSON.stringify(result);
    for (const identifier of [aliceId, bobId, 'clerk_alice', 'clerk_bob']) {
      expect(publicPayload).not.toContain(identifier);
    }
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
