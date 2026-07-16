/**
 * game.test.ts — migrated to convex-test (backlog 018).
 *
 * Exercises game.ts mutations and queries against the real convex-test
 * in-memory engine (real read-your-writes + real scheduler) instead of the
 * mock DB. The only mocked boundary is the OpenRouter `fetch`, stubbed offline
 * so every AI path falls through to deterministic fallbacks.
 *
 * Covers: startGame, startNewCycle, getCurrentAssignment, submitLine,
 *         getRevealPhaseState, revealPoem, getRoundProgress, summonGhostwriter.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { setupConvexTest } from '../helpers/convexTest';
import { type T, asUser, seedClerkUser, seedUser } from '../helpers/convexSeed';
import {
  WORD_COUNTS,
  GHOSTWRITER_OVERTIME_MS,
  PRESENCE_AWAY_MS,
} from '../../convex/lib/gameRules';
import { signGuestToken } from '../../lib/guestToken';
import {
  ABUSE_RATE_LIMITS,
  type AbuseRateLimitOperation,
  guestBucketRateLimitKey,
} from '../../convex/lib/abuseRateLimit';

/**
 * Seed a fully-wired LOBBY with two human players.
 * Host = clerk_host{suffix}, Guest = clerk_guest{suffix}.
 */
async function seedLobby(
  t: T,
  suffix = ''
): Promise<{
  code: string;
  roomId: Id<'rooms'>;
  hostId: Id<'users'>;
  guestId: Id<'users'>;
}> {
  await seedClerkUser(t, `host${suffix}`);
  await seedClerkUser(t, `guest${suffix}`);

  const { code, roomId } = await asUser(t, `host${suffix}`).mutation(
    api.rooms.createRoom,
    { displayName: `Host${suffix}` }
  );
  await asUser(t, `guest${suffix}`).mutation(api.rooms.joinRoom, {
    code,
    displayName: `Guest${suffix}`,
  });

  const hostId = await t.run((ctx) =>
    ctx.db
      .query('users')
      .withIndex('by_clerk', (q) => q.eq('clerkUserId', `clerk_host${suffix}`))
      .first()
      .then((u) => u!._id)
  );
  const guestId = await t.run((ctx) =>
    ctx.db
      .query('users')
      .withIndex('by_clerk', (q) => q.eq('clerkUserId', `clerk_guest${suffix}`))
      .first()
      .then((u) => u!._id)
  );

  return { code, roomId, hostId, guestId };
}

/**
 * Seed a COMPLETED room with a completed game, ready for startNewCycle.
 * Code is derived from suffix (upper-cased, truncated/padded to 4 chars).
 */
async function seedCompletedRoom(
  t: T,
  suffix: string
): Promise<{
  roomId: Id<'rooms'>;
  gameId: Id<'games'>;
  hostId: Id<'users'>;
  guestId: Id<'users'>;
  code: string;
}> {
  const raw = suffix.toUpperCase().replace(/[^A-Z]/g, 'X');
  const code = raw.slice(0, 4).padEnd(4, 'X');
  return t.run(async (ctx) => {
    const hostId = await ctx.db.insert('users', {
      displayName: `Host${suffix}`,
      kind: 'human',
      clerkUserId: `clerk_host${suffix}`,
      createdAt: 0,
    });
    const guestId = await ctx.db.insert('users', {
      displayName: `Guest${suffix}`,
      kind: 'human',
      clerkUserId: `clerk_guest${suffix}`,
      createdAt: 0,
    });
    const roomId = await ctx.db.insert('rooms', {
      code,
      hostUserId: hostId,
      status: 'COMPLETED',
      currentCycle: 1,
      createdAt: 0,
    });
    await ctx.db.insert('roomPlayers', {
      roomId,
      userId: hostId,
      displayName: `Host${suffix}`,
      seatIndex: 0,
      joinedAt: 0,
    });
    await ctx.db.insert('roomPlayers', {
      roomId,
      userId: guestId,
      displayName: `Guest${suffix}`,
      seatIndex: 1,
      joinedAt: 0,
    });
    const gameId = await ctx.db.insert('games', {
      roomId,
      status: 'COMPLETED',
      cycle: 1,
      currentRound: 8,
      // A real nine-round matrix (alternating, no consecutive same-poem author),
      // so round bounds derive consistently from its length.
      assignmentMatrix: Array.from({ length: 9 }, (_, r) =>
        r % 2 === 0 ? [hostId, guestId] : [guestId, hostId]
      ),
      createdAt: 0,
    });
    return { roomId, gameId, hostId, guestId, code };
  });
}

async function seedRevealFallbackRoom(
  t: T,
  suffix: string,
  lastSeenAt: {
    host: number;
    reader: number;
    fallback: number;
  }
): Promise<{
  code: string;
  poemId: Id<'poems'>;
  hostId: Id<'users'>;
  readerId: Id<'users'>;
  fallbackId: Id<'users'>;
}> {
  const code = suffix
    .toUpperCase()
    .replace(/[^A-Z]/g, 'X')
    .slice(0, 4);

  return t.run(async (ctx) => {
    const [hostId, readerId, fallbackId] = await Promise.all(
      ['host', 'reader', 'fallback'].map((role) =>
        ctx.db.insert('users', {
          displayName: `${role}${suffix}`,
          kind: 'human',
          clerkUserId: `clerk_${role}${suffix}`,
          createdAt: 0,
        })
      )
    );
    const roomId = await ctx.db.insert('rooms', {
      code,
      hostUserId: hostId,
      status: 'COMPLETED',
      createdAt: 0,
    });

    await Promise.all(
      [
        { userId: hostId, role: 'host' as const, seatIndex: 0 },
        { userId: readerId, role: 'reader' as const, seatIndex: 1 },
        { userId: fallbackId, role: 'fallback' as const, seatIndex: 2 },
      ].map(({ userId, role, seatIndex }) =>
        ctx.db.insert('roomPlayers', {
          roomId,
          userId,
          displayName: `${role}${suffix}`,
          seatIndex,
          joinedAt: 0,
          lastSeenAt: lastSeenAt[role],
        })
      )
    );

    const gameId = await ctx.db.insert('games', {
      roomId,
      status: 'COMPLETED',
      cycle: 1,
      currentRound: WORD_COUNTS.length - 1,
      assignmentMatrix: Array.from({ length: WORD_COUNTS.length }, () => [
        hostId,
        readerId,
        fallbackId,
      ]),
      createdAt: 0,
      completedAt: 1,
    });
    const poemId = await ctx.db.insert('poems', {
      roomId,
      gameId,
      indexInRoom: 0,
      createdAt: 0,
      assignedReaderId: readerId,
    });

    return { code, poemId, hostId, readerId, fallbackId };
  });
}

/**
 * Seed an IN_PROGRESS game directly (bypasses auth/lobby).
 * The assignment matrix is a deterministic cyclic shift: row r[poem] = userIds[(poem+r)%n].
 */
async function seedInProgressGame(
  t: T,
  opts: {
    players: Array<{
      name: string;
      clerkUserId?: string;
      kind?: 'human' | 'AI';
    }>;
    code?: string;
    currentRound?: number;
    roundStartedAt?: number;
    /** Matrix round count. Defaults to the one-game shape; a smaller value
     *  seeds a legacy in-flight game (e.g. a pre-consolidation 5-round). */
    rounds?: number;
  }
): Promise<{
  roomId: Id<'rooms'>;
  gameId: Id<'games'>;
  userIds: Id<'users'>[];
  poemIds: Id<'poems'>[];
  matrix: Id<'users'>[][];
  code: string;
}> {
  const code = opts.code ?? 'TEST';
  const currentRound = opts.currentRound ?? 0;
  const rounds = opts.rounds ?? WORD_COUNTS.length;
  const now = Date.now();
  const roundStartedAt = opts.roundStartedAt ?? now;

  return t.run(async (ctx) => {
    const userIds: Id<'users'>[] = [];
    for (const p of opts.players) {
      userIds.push(
        await ctx.db.insert('users', {
          displayName: p.name,
          kind: p.kind ?? 'human',
          ...(p.clerkUserId ? { clerkUserId: p.clerkUserId } : {}),
          createdAt: now,
        })
      );
    }

    const roomId = await ctx.db.insert('rooms', {
      code,
      hostUserId: userIds[0],
      status: 'IN_PROGRESS',
      createdAt: now,
    });

    await Promise.all(
      opts.players.map((p, i) =>
        ctx.db.insert('roomPlayers', {
          roomId,
          userId: userIds[i],
          displayName: p.name,
          seatIndex: i,
          joinedAt: now,
        })
      )
    );

    const n = userIds.length;
    const matrix: Id<'users'>[][] = [];
    for (let r = 0; r < rounds; r++) {
      matrix.push(
        Array.from({ length: n }, (_, poem) => userIds[(poem + r) % n])
      );
    }

    const gameId = await ctx.db.insert('games', {
      roomId,
      status: 'IN_PROGRESS',
      cycle: 1,
      currentRound,
      roundStartedAt,
      assignmentMatrix: matrix,
      createdAt: now,
    });

    const poemIds: Id<'poems'>[] = [];
    for (let i = 0; i < n; i++) {
      poemIds.push(
        await ctx.db.insert('poems', {
          roomId,
          gameId,
          indexInRoom: i,
          createdAt: now,
        })
      );
    }

    return { roomId, gameId, userIds, poemIds, matrix, code };
  });
}

async function seedExhaustedGuestBucket(
  t: T,
  operation: AbuseRateLimitOperation,
  bucket: string
) {
  await t.run((ctx) =>
    ctx.db.insert('rateLimits', {
      key: guestBucketRateLimitKey(operation, bucket),
      hits: ABUSE_RATE_LIMITS[operation].bucketMax,
      resetTime: Date.now() + ABUSE_RATE_LIMITS[operation].windowMs,
    })
  );
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('network disabled in test')))
  );
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// ─── startNewCycle ────────────────────────────────────────────────────────────

describe('startNewCycle', () => {
  it('throws if user not found (no identity)', async () => {
    const t = setupConvexTest();
    const { code } = await seedCompletedRoom(t, 'SNC0');

    await expect(
      t.mutation(api.game.startNewCycle, { roomCode: code })
    ).rejects.toThrow('User not found');
  });

  it('throws if room not found', async () => {
    const t = setupConvexTest();
    await seedClerkUser(t, 'snc1user');

    await expect(
      asUser(t, 'snc1user').mutation(api.game.startNewCycle, {
        roomCode: 'ZZZZ',
      })
    ).rejects.toThrow();
  });

  it('throws if user is not a participant', async () => {
    const t = setupConvexTest();
    const { code } = await seedCompletedRoom(t, 'SNC2');
    await seedClerkUser(t, 'outsidersnc2');

    await expect(
      asUser(t, 'outsidersnc2').mutation(api.game.startNewCycle, {
        roomCode: code,
      })
    ).rejects.toThrow('Only players in this room can start a new cycle');
  });

  it('throws if game still in progress', async () => {
    const t = setupConvexTest();
    const { code } = await seedLobby(t, 'SNC3');
    await asUser(t, 'hostSNC3').mutation(api.game.startGame, { code });

    await expect(
      asUser(t, 'hostSNC3').mutation(api.game.startNewCycle, { roomCode: code })
    ).rejects.toThrow('Game still in progress');
  });

  it('throws if no completed game', async () => {
    const t = setupConvexTest();
    const { code } = await seedLobby(t, 'SNC4');

    await expect(
      asUser(t, 'hostSNC4').mutation(api.game.startNewCycle, { roomCode: code })
    ).rejects.toThrow('No completed game to continue from');
  });

  it('resets room to LOBBY on success for any participant (non-host)', async () => {
    const t = setupConvexTest();
    const { roomId, code } = await seedCompletedRoom(t, 'SNC5');

    await asUser(t, 'guestSNC5').mutation(api.game.startNewCycle, {
      roomCode: code,
    });

    const room = await t.run((ctx) => ctx.db.get(roomId));
    expect(room?.status).toBe('LOBBY');
    expect(room?.currentGameId).toBeUndefined();
  });

  it('resets room to LOBBY on success for host', async () => {
    const t = setupConvexTest();
    const { roomId, code } = await seedCompletedRoom(t, 'SNC6');

    await asUser(t, 'hostSNC6').mutation(api.game.startNewCycle, {
      roomCode: code,
    });

    const room = await t.run((ctx) => ctx.db.get(roomId));
    expect(room?.status).toBe('LOBBY');
    expect(room?.currentGameId).toBeUndefined();
  });
});

// ─── startGame ───────────────────────────────────────────────────────────────

describe('startGame', () => {
  it('starts game successfully — creates game, poems, and assignment matrix', async () => {
    const t = setupConvexTest();
    const { code, roomId } = await seedLobby(t, 'SG1');

    await asUser(t, 'hostSG1').mutation(api.game.startGame, { code });

    const room = await t.run((ctx) => ctx.db.get(roomId));
    expect(room?.status).toBe('IN_PROGRESS');
    expect(room?.currentGameId).toBeDefined();

    const gameId = room!.currentGameId!;
    const game = await t.run((ctx) => ctx.db.get(gameId));
    expect(game?.status).toBe('IN_PROGRESS');
    expect(game?.currentRound).toBe(0);
    expect(Array.isArray(game?.assignmentMatrix)).toBe(true);

    const poems = await t.run((ctx) =>
      ctx.db
        .query('poems')
        .withIndex('by_game', (q) => q.eq('gameId', gameId))
        .collect()
    );
    expect(poems).toHaveLength(2);
  });

  it('rate-limits guest starts by signed network bucket before room lookup', async () => {
    const t = setupConvexTest();
    const bucket = 'guestSession:testStartBucket1234567890';
    const guestId = 'guest-start-blocked';
    await seedUser(t, { displayName: 'Blocked Starter', guestId });
    await seedExhaustedGuestBucket(t, 'startGame', bucket);
    const guestToken = await signGuestToken(guestId, {
      sessionId: 'session-start-blocked',
      rateLimitKey: bucket,
    });

    await expect(
      t.mutation(api.game.startGame, { code: 'NOPE', guestToken })
    ).rejects.toThrow('Rate limit exceeded');
  });

  it('blocks a non-host before the first game completes', async () => {
    const t = setupConvexTest();
    const { code } = await seedLobby(t, 'SG2');

    await expect(
      asUser(t, 'guestSG2').mutation(api.game.startGame, { code })
    ).rejects.toThrow('Only host can start game');
  });

  it('lets any participant fire the rematch once a game has completed', async () => {
    const t = setupConvexTest();
    const { code, roomId } = await seedCompletedRoom(t, 'SG3A');

    // Reset to LOBBY; completed game still exists in DB → guest can rematch
    await asUser(t, 'hostSG3A').mutation(api.game.startNewCycle, {
      roomCode: code,
    });

    await asUser(t, 'guestSG3A').mutation(api.game.startGame, { code });

    const room = await t.run((ctx) => ctx.db.get(roomId));
    expect(room?.status).toBe('IN_PROGRESS');

    const game = await t.run((ctx) => ctx.db.get(room!.currentGameId!));
    expect(game?.status).toBe('IN_PROGRESS');
  });

  it('throws when there is only one player', async () => {
    const t = setupConvexTest();
    await seedClerkUser(t, 'soloSG4');
    const { code } = await asUser(t, 'soloSG4').mutation(api.rooms.createRoom, {
      displayName: 'Solo',
    });

    await expect(
      asUser(t, 'soloSG4').mutation(api.game.startGame, { code })
    ).rejects.toThrow('Need at least 2 players');
  });

  it('throws when a game is already in progress', async () => {
    const t = setupConvexTest();
    const { code } = await seedLobby(t, 'SG5');
    await asUser(t, 'hostSG5').mutation(api.game.startGame, { code });

    await expect(
      asUser(t, 'hostSG5').mutation(api.game.startGame, { code })
    ).rejects.toThrow('Game already in progress');
  });
});

// ─── summonGhostwriter ────────────────────────────────────────────────────────

describe('summonGhostwriter', () => {
  it('rejects non-hosts', async () => {
    const t = setupConvexTest();
    const { code, gameId } = await seedInProgressGame(t, {
      players: [
        { name: 'Host', clerkUserId: 'clerk_ghosthostA' },
        { name: 'Guest', clerkUserId: 'clerk_ghostguestA' },
      ],
      code: 'GWA1',
      currentRound: 0,
    });
    // Patch past overtime so the overtime check doesn't fire first
    await t.run((ctx) =>
      ctx.db.patch(gameId, {
        roundStartedAt: Date.now() - GHOSTWRITER_OVERTIME_MS - 10_000,
      })
    );

    await expect(
      asUser(t, 'ghostguestA').mutation(api.game.summonGhostwriter, {
        roomCode: code,
      })
    ).rejects.toThrow('Only host can summon the ghostwriter');
  });

  it('does not let a non-host consume the room summon quota', async () => {
    const t = setupConvexTest();
    const { code, roomId } = await seedInProgressGame(t, {
      players: [
        { name: 'Host', clerkUserId: 'clerk_ghostquotaHost' },
        { name: 'Guest', clerkUserId: 'clerk_ghostquotaGuest' },
      ],
      code: 'GWQ1',
      currentRound: 0,
      roundStartedAt: Date.now() - GHOSTWRITER_OVERTIME_MS - 1_000,
    });
    const key = `mutation:summonGhostwriter:room:${roomId}`;
    await t.run((ctx) =>
      ctx.db.insert('rateLimits', {
        key,
        hits: ABUSE_RATE_LIMITS.summonGhostwriter.roomMax - 1,
        resetTime: Date.now() + ABUSE_RATE_LIMITS.summonGhostwriter.windowMs,
      })
    );

    await expect(
      asUser(t, 'ghostquotaGuest').mutation(api.game.summonGhostwriter, {
        roomCode: code,
      })
    ).rejects.toThrow('Only host can summon the ghostwriter');

    const limit = await t.run((ctx) =>
      ctx.db
        .query('rateLimits')
        .withIndex('by_key', (q) => q.eq('key', key))
        .first()
    );
    expect(limit?.hits).toBe(ABUSE_RATE_LIMITS.summonGhostwriter.roomMax - 1);
  });

  it('rejects before overtime', async () => {
    const t = setupConvexTest();
    const { code } = await seedInProgressGame(t, {
      players: [
        { name: 'Host', clerkUserId: 'clerk_ghosthostB' },
        { name: 'Guest', clerkUserId: 'clerk_ghostguestB' },
      ],
      code: 'GWB1',
      roundStartedAt: Date.now() - 5_000, // round just opened
    });

    await expect(
      asUser(t, 'ghosthostB').mutation(api.game.summonGhostwriter, {
        roomCode: code,
      })
    ).rejects.toThrow('The ghostwriter only answers after overtime');
  });

  it('rate-limits summon attempts per actor', async () => {
    const t = setupConvexTest();
    const { code, userIds, gameId } = await seedInProgressGame(t, {
      players: [
        { name: 'Host', clerkUserId: 'clerk_ghostlimitactor' },
        { name: 'Guest', clerkUserId: 'clerk_ghostlimitactorguest' },
      ],
      code: 'GWL1',
      currentRound: 0,
      roundStartedAt: Date.now() - GHOSTWRITER_OVERTIME_MS - 1_000,
    });
    await t.run((ctx) =>
      ctx.db.insert('rateLimits', {
        key: `mutation:summonGhostwriter:user:${userIds[0]}`,
        hits: ABUSE_RATE_LIMITS.summonGhostwriter.userMax,
        resetTime: Date.now() + ABUSE_RATE_LIMITS.summonGhostwriter.windowMs,
      })
    );

    await expect(
      asUser(t, 'ghostlimitactor').mutation(api.game.summonGhostwriter, {
        roomCode: code,
      })
    ).rejects.toThrow('Rate limit exceeded');

    expect(
      await t.run((ctx) =>
        ctx.db
          .query('aiTurns')
          .withIndex('by_game_round', (q) =>
            q.eq('gameId', gameId).eq('round', 0)
          )
          .collect()
      )
    ).toHaveLength(0);
  });

  it('rate-limits summon attempts per room', async () => {
    const t = setupConvexTest();
    const { code, roomId } = await seedInProgressGame(t, {
      players: [
        { name: 'Host', clerkUserId: 'clerk_ghostlimitroom' },
        { name: 'Guest', clerkUserId: 'clerk_ghostlimitroomguest' },
      ],
      code: 'GWL2',
      currentRound: 0,
      roundStartedAt: Date.now() - GHOSTWRITER_OVERTIME_MS - 1_000,
    });
    await t.run((ctx) =>
      ctx.db.insert('rateLimits', {
        key: `mutation:summonGhostwriter:room:${roomId}`,
        hits: ABUSE_RATE_LIMITS.summonGhostwriter.roomMax,
        resetTime: Date.now() + ABUSE_RATE_LIMITS.summonGhostwriter.windowMs,
      })
    );

    await expect(
      asUser(t, 'ghostlimitroom').mutation(api.game.summonGhostwriter, {
        roomCode: code,
      })
    ).rejects.toThrow('Rate limit exceeded');
  });

  it('schedules ghost lines for every missing poem after overtime', async () => {
    const t = setupConvexTest();
    const { code, poemIds, userIds, gameId } = await seedInProgressGame(t, {
      players: [
        { name: 'Host', clerkUserId: 'clerk_ghosthostC' },
        { name: 'Guest', clerkUserId: 'clerk_ghostguestC' },
      ],
      code: 'GWC1',
      currentRound: 0,
    });

    // Patch past overtime
    await t.run((ctx) =>
      ctx.db.patch(gameId, {
        roundStartedAt: Date.now() - GHOSTWRITER_OVERTIME_MS - 10_000,
      })
    );

    // poem[0] has a line, poem[1] is missing
    // matrix[0][0] = userIds[0] (Host) → poem 0
    await t.run((ctx) =>
      ctx.db.insert('lines', {
        poemId: poemIds[0],
        indexInPoem: 0,
        text: 'hello',
        wordCount: 1,
        authorUserId: userIds[0],
        createdAt: Date.now(),
      })
    );

    const result = await asUser(t, 'ghosthostC').mutation(
      api.game.summonGhostwriter,
      { roomCode: code }
    );

    expect(result).toEqual({ summoned: 1 });

    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const line = await t.run((ctx) =>
      ctx.db
        .query('lines')
        .withIndex('by_poem_index', (q) =>
          q.eq('poemId', poemIds[1]).eq('indexInPoem', 0)
        )
        .first()
    );
    expect(line).not.toBeNull();
  });

  it('does not summon a ghostwriter for an AI-assigned cell', async () => {
    const t = setupConvexTest();
    const { code, roomId, poemIds, userIds } = await seedInProgressGame(t, {
      players: [
        { name: 'Host', clerkUserId: 'clerk_ghosthumanhost' },
        { name: 'Bot', kind: 'AI' },
      ],
      code: 'GWAI',
      currentRound: 0,
      roundStartedAt: Date.now() - GHOSTWRITER_OVERTIME_MS - 1_000,
    });

    // Round zero assigns the host to poem 0 and the bot to poem 1. Leave only
    // the bot cell open: its generation action, not the ghostwriter, owns it.
    await t.run((ctx) =>
      ctx.db.insert('lines', {
        poemId: poemIds[0],
        indexInPoem: 0,
        text: 'done',
        wordCount: 1,
        authorUserId: userIds[0],
        createdAt: Date.now(),
      })
    );

    const result = await asUser(t, 'ghosthumanhost').mutation(
      api.game.summonGhostwriter,
      { roomCode: code }
    );

    expect(result).toEqual({ summoned: 0 });
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('rateLimits')
          .withIndex('by_key', (q) =>
            q.eq('key', `mutation:summonGhostwriter:room:${roomId}`)
          )
          .first()
      )
    ).toBeNull();
  });

  it('does not debit summon quotas for an already-claimed cell', async () => {
    const t = setupConvexTest();
    const { code, roomId, gameId, poemIds, userIds } = await seedInProgressGame(
      t,
      {
        players: [
          { name: 'Host', clerkUserId: 'clerk_ghostclaimedhost' },
          { name: 'Guest' },
        ],
        code: 'GWCL',
        currentRound: 0,
        roundStartedAt: Date.now() - GHOSTWRITER_OVERTIME_MS - 1_000,
      }
    );

    await t.run(async (ctx) => {
      await ctx.db.insert('lines', {
        poemId: poemIds[1],
        indexInPoem: 0,
        text: 'done',
        wordCount: 1,
        authorUserId: userIds[1],
        createdAt: Date.now(),
      });
      await ctx.db.insert('aiTurns', {
        roomId,
        gameId,
        poemId: poemIds[0],
        round: 0,
        aiUserId: userIds[0],
        day: new Date().toISOString().slice(0, 10),
        status: 'authorized',
        claimedAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const result = await asUser(t, 'ghostclaimedhost').mutation(
      api.game.summonGhostwriter,
      { roomCode: code }
    );

    expect(result).toEqual({ summoned: 0 });
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('rateLimits')
          .withIndex('by_key', (q) =>
            q.eq('key', `mutation:summonGhostwriter:room:${roomId}`)
          )
          .first()
      )
    ).toBeNull();
  });

  it('is a no-op when every poem already has its line', async () => {
    const t = setupConvexTest();
    const { code, poemIds, userIds, gameId } = await seedInProgressGame(t, {
      players: [
        { name: 'Host', clerkUserId: 'clerk_ghosthostD' },
        { name: 'Guest', clerkUserId: 'clerk_ghostguestD' },
      ],
      code: 'GWD1',
      currentRound: 0,
    });

    await t.run((ctx) =>
      ctx.db.patch(gameId, {
        roundStartedAt: Date.now() - GHOSTWRITER_OVERTIME_MS - 10_000,
      })
    );

    await t.run(async (ctx) => {
      await ctx.db.insert('lines', {
        poemId: poemIds[0],
        indexInPoem: 0,
        text: 'hello',
        wordCount: 1,
        authorUserId: userIds[0],
        createdAt: Date.now(),
      });
      await ctx.db.insert('lines', {
        poemId: poemIds[1],
        indexInPoem: 0,
        text: 'world',
        wordCount: 1,
        authorUserId: userIds[1],
        createdAt: Date.now(),
      });
    });

    const result = await asUser(t, 'ghosthostD').mutation(
      api.game.summonGhostwriter,
      { roomCode: code }
    );

    expect(result).toEqual({ summoned: 0 });
  });
});

// ─── getCurrentAssignment ─────────────────────────────────────────────────────

describe('getCurrentAssignment', () => {
  it('returns null if user not found (no identity)', async () => {
    const t = setupConvexTest();
    await seedInProgressGame(t, {
      players: [{ name: 'A' }, { name: 'B' }],
      code: 'CA01',
    });

    const result = await t.query(api.game.getCurrentAssignment, {
      roomCode: 'CA01',
    });
    expect(result).toBeNull();
  });

  it('returns null if room not found', async () => {
    const t = setupConvexTest();
    await seedClerkUser(t, 'ca02user');

    const result = await asUser(t, 'ca02user').query(
      api.game.getCurrentAssignment,
      { roomCode: 'ZZZZ' }
    );
    expect(result).toBeNull();
  });

  it('returns null if no game in progress', async () => {
    const t = setupConvexTest();
    const { code } = await seedLobby(t, 'CA03');

    const result = await asUser(t, 'hostCA03').query(
      api.game.getCurrentAssignment,
      { roomCode: code }
    );
    expect(result).toBeNull();
  });

  it('returns null if user not in assignment matrix', async () => {
    const t = setupConvexTest();
    const { code } = await seedInProgressGame(t, {
      players: [
        { name: 'Alice', clerkUserId: 'clerk_aliceCA04' },
        { name: 'Bob', clerkUserId: 'clerk_bobCA04' },
      ],
      code: 'CA04',
    });
    await seedClerkUser(t, 'outsiderCA04');

    const result = await asUser(t, 'outsiderCA04').query(
      api.game.getCurrentAssignment,
      { roomCode: code }
    );
    expect(result).toBeNull();
  });

  it('returns assignment with previous line for round > 0', async () => {
    const t = setupConvexTest();
    const { code, poemIds, userIds } = await seedInProgressGame(t, {
      players: [
        { name: 'Alice', clerkUserId: 'clerk_aliceCA05' },
        { name: 'Bob', clerkUserId: 'clerk_bobCA05' },
      ],
      code: 'CA05',
      currentRound: 2,
    });

    // matrix[2][0] = userIds[(0+2)%2] = userIds[0] = Alice → poem 0
    // Insert previous line (round 1) for poem 0
    await t.run((ctx) =>
      ctx.db.insert('lines', {
        poemId: poemIds[0],
        indexInPoem: 1,
        text: 'one two',
        wordCount: 2,
        authorUserId: userIds[1],
        createdAt: Date.now(),
      })
    );

    const result = await asUser(t, 'aliceCA05').query(
      api.game.getCurrentAssignment,
      { roomCode: code }
    );

    expect(result).not.toBeNull();
    expect(result!.poemId).toBe(poemIds[0]);
    expect(result!.lineIndex).toBe(2);
    expect(result!.targetWordCount).toBe(3); // WORD_COUNTS[2]
    expect(result!.totalRounds).toBe(9);
    expect(result!.isFinalRound).toBe(false);
    expect(result!.hasSubmitted).toBe(false);
    expect(result!.previousLineText).toBe('one two');
  });

  it('reports when the current assignment was already submitted', async () => {
    const t = setupConvexTest();
    const { code, poemIds, userIds } = await seedInProgressGame(t, {
      players: [
        { name: 'Alice', clerkUserId: 'clerk_aliceCA07' },
        { name: 'Bob', clerkUserId: 'clerk_bobCA07' },
      ],
      code: 'CA07',
    });

    await t.run((ctx) =>
      ctx.db.insert('lines', {
        poemId: poemIds[0],
        indexInPoem: 0,
        text: 'sealed',
        wordCount: 1,
        authorUserId: userIds[0],
        createdAt: Date.now(),
      })
    );

    const result = await asUser(t, 'aliceCA07').query(
      api.game.getCurrentAssignment,
      { roomCode: code }
    );

    expect(result?.hasSubmitted).toBe(true);
  });

  it('stores every rematch submission in the active game poems', async () => {
    const t = setupConvexTest();
    const { code, roomId, gameId, hostId, guestId } = await seedCompletedRoom(
      t,
      'CA06'
    );

    const { oldPoemIds, oldPoemsBefore, oldLinesBefore } = await t.run(
      async (ctx) => {
        const poemIds = await Promise.all(
          [0, 1].map((indexInRoom) =>
            ctx.db.insert('poems', {
              roomId,
              gameId,
              indexInRoom,
              createdAt: 0,
            })
          )
        );

        await Promise.all(
          poemIds.flatMap((poemId, poemIndex) =>
            WORD_COUNTS.map((wordCount, lineIndex) =>
              ctx.db.insert('lines', {
                poemId,
                indexInPoem: lineIndex,
                text: Array.from(
                  { length: wordCount },
                  (_, wordIndex) => `old${poemIndex}${lineIndex}${wordIndex}`
                ).join(' '),
                wordCount,
                authorUserId:
                  (lineIndex + poemIndex) % 2 === 0 ? hostId : guestId,
                createdAt: lineIndex,
              })
            )
          )
        );

        const oldPoems = await Promise.all(
          poemIds.map((poemId) => ctx.db.get(poemId))
        );
        const oldLines = await Promise.all(
          poemIds.map((poemId) =>
            ctx.db
              .query('lines')
              .withIndex('by_poem', (q) => q.eq('poemId', poemId))
              .collect()
          )
        );

        return {
          oldPoemIds: poemIds,
          oldPoemsBefore: oldPoems,
          oldLinesBefore: oldLines,
        };
      }
    );

    await asUser(t, 'hostCA06').mutation(api.game.startGame, { code });

    const activeGameId = await t.run(async (ctx) => {
      const room = await ctx.db.get(roomId);
      expect(room?.currentCycle).toBe(2);
      return room!.currentGameId!;
    });
    const expectedTextByCell = new Map<string, string>();

    for (let round = 0; round < WORD_COUNTS.length; round += 1) {
      const [hostAssignment, guestAssignment] = await Promise.all([
        asUser(t, 'hostCA06').query(api.game.getCurrentAssignment, {
          roomCode: code,
        }),
        asUser(t, 'guestCA06').query(api.game.getCurrentAssignment, {
          roomCode: code,
        }),
      ]);

      expect(hostAssignment?.lineIndex).toBe(round);
      expect(guestAssignment?.lineIndex).toBe(round);

      const assignments = [
        {
          identity: 'hostCA06',
          assignment: hostAssignment!,
          prefix: 'host',
        },
        {
          identity: 'guestCA06',
          assignment: guestAssignment!,
          prefix: 'guest',
        },
      ];

      for (const { assignment } of assignments) {
        const poem = await t.run((ctx) => ctx.db.get(assignment.poemId));
        expect(poem?.gameId).toBe(activeGameId);
      }

      await Promise.all(
        assignments.map(async ({ identity, assignment, prefix }) => {
          const text = Array.from(
            { length: WORD_COUNTS[round] },
            (_, wordIndex) => `${prefix}${round}${wordIndex}`
          ).join(' ');
          expectedTextByCell.set(`${assignment.poemId}:${round}`, text);
          await asUser(t, identity).mutation(api.game.submitLine, {
            poemId: assignment.poemId,
            lineIndex: round,
            text,
          });
        })
      );
    }

    const result = await t.run(async (ctx) => {
      const [activeGame, activePoems, oldPoems, oldLines] = await Promise.all([
        ctx.db.get(activeGameId),
        ctx.db
          .query('poems')
          .withIndex('by_game', (q) => q.eq('gameId', activeGameId))
          .collect(),
        Promise.all(oldPoemIds.map((poemId) => ctx.db.get(poemId))),
        Promise.all(
          oldPoemIds.map((poemId) =>
            ctx.db
              .query('lines')
              .withIndex('by_poem', (q) => q.eq('poemId', poemId))
              .collect()
          )
        ),
      ]);
      const activeLines = await Promise.all(
        activePoems.map(async (poem) => ({
          poemId: poem._id,
          lines: await ctx.db
            .query('lines')
            .withIndex('by_poem', (q) => q.eq('poemId', poem._id))
            .collect(),
        }))
      );
      return { activeGame, activeLines, oldPoems, oldLines };
    });

    expect(result.activeGame?.status).toBe('COMPLETED');
    expect(result.oldPoems).toEqual(oldPoemsBefore);
    expect(result.oldLines).toEqual(oldLinesBefore);
    expect(result.activeLines.flatMap(({ lines }) => lines)).toHaveLength(
      2 * WORD_COUNTS.length
    );
    for (const { poemId, lines } of result.activeLines) {
      for (const line of lines) {
        expect(line.text).toBe(
          expectedTextByCell.get(`${poemId}:${line.indexInPoem}`)
        );
      }
    }
  });
});

// ─── submitLine ───────────────────────────────────────────────────────────────

describe('submitLine', () => {
  it('throws if game not in progress (status COMPLETED)', async () => {
    const t = setupConvexTest();
    const { gameId, roomId } = await seedCompletedRoom(t, 'SL01');

    const poemId = await t.run((ctx) =>
      ctx.db.insert('poems', {
        roomId,
        gameId,
        indexInRoom: 0,
        createdAt: 0,
      })
    );

    await expect(
      asUser(t, 'hostSL01').mutation(api.game.submitLine, {
        poemId,
        lineIndex: 0,
        text: 'hello',
      })
    ).rejects.toThrow('Game not in progress');
  });

  it('rate-limits guest submissions by signed network bucket before line validation', async () => {
    const t = setupConvexTest();
    const bucket = 'guestSession:testSubmitBucket1234567890';
    const guestId = 'guest-submit-blocked';
    const { poemIds, userIds } = await seedInProgressGame(t, {
      players: [
        { name: 'Alice', clerkUserId: 'clerk_aliceSLRL' },
        { name: 'Bob', clerkUserId: 'clerk_bobSLRL' },
      ],
      code: 'SLRL',
      currentRound: 0,
    });
    await t.run((ctx) => ctx.db.patch(userIds[0], { guestId }));
    await seedExhaustedGuestBucket(t, 'submitLine', bucket);
    const guestToken = await signGuestToken(guestId, {
      sessionId: 'session-submit-blocked',
      rateLimitKey: bucket,
    });

    await expect(
      t.mutation(api.game.submitLine, {
        poemId: poemIds[0],
        lineIndex: 0,
        text: 'hello',
        guestToken,
      })
    ).rejects.toThrow('Rate limit exceeded');
  });

  it('throws if word count is incorrect', async () => {
    const t = setupConvexTest();
    const { poemIds } = await seedInProgressGame(t, {
      players: [
        { name: 'Alice', clerkUserId: 'clerk_aliceSL02' },
        { name: 'Bob', clerkUserId: 'clerk_bobSL02' },
      ],
      code: 'SL02',
      currentRound: 2,
    });
    // matrix[2][0] = Alice → poem 0; round 2 expects 3 words
    await expect(
      asUser(t, 'aliceSL02').mutation(api.game.submitLine, {
        poemId: poemIds[0],
        lineIndex: 2,
        text: 'hello world', // only 2 words
      })
    ).rejects.toThrow('Expected 3 words, got 2');
  });

  it('throws if line text exceeds 500 characters', async () => {
    const t = setupConvexTest();
    const { poemIds } = await seedInProgressGame(t, {
      players: [
        { name: 'Alice', clerkUserId: 'clerk_aliceSL03' },
        { name: 'Bob', clerkUserId: 'clerk_bobSL03' },
      ],
      code: 'SL03',
      currentRound: 0,
    });
    const longText = 'a'.repeat(501);

    await expect(
      asUser(t, 'aliceSL03').mutation(api.game.submitLine, {
        poemId: poemIds[0],
        lineIndex: 0,
        text: longText,
      })
    ).rejects.toThrow('Line must be 500 characters or less');
  });

  it('accepts line text at exactly 500 characters (1-word round)', async () => {
    const t = setupConvexTest();
    const { poemIds } = await seedInProgressGame(t, {
      players: [
        { name: 'Alice', clerkUserId: 'clerk_aliceSL04' },
        { name: 'Bob', clerkUserId: 'clerk_bobSL04' },
      ],
      code: 'SL04',
      currentRound: 0,
    });
    const exactText = 'a'.repeat(500);

    await asUser(t, 'aliceSL04').mutation(api.game.submitLine, {
      poemId: poemIds[0],
      lineIndex: 0,
      text: exactText,
    });

    const line = await t.run((ctx) =>
      ctx.db
        .query('lines')
        .withIndex('by_poem_index', (q) =>
          q.eq('poemId', poemIds[0]).eq('indexInPoem', 0)
        )
        .first()
    );
    expect(line).not.toBeNull();
    expect(line!.text).toBe(exactText);
    expect(line!.wordCount).toBe(1);
  });

  it('collapses pasted whitespace before storing a line', async () => {
    const t = setupConvexTest();
    const { poemIds } = await seedInProgressGame(t, {
      players: [
        { name: 'Alice', clerkUserId: 'clerk_aliceSLWS' },
        { name: 'Bob', clerkUserId: 'clerk_bobSLWS' },
      ],
      code: 'SLWS',
      currentRound: 1,
    });

    await asUser(t, 'bobSLWS').mutation(api.game.submitLine, {
      poemId: poemIds[0],
      lineIndex: 1,
      text: 'hello\nworld',
    });

    const line = await t.run((ctx) =>
      ctx.db
        .query('lines')
        .withIndex('by_poem_index', (q) =>
          q.eq('poemId', poemIds[0]).eq('indexInPoem', 1)
        )
        .first()
    );
    expect(line?.text).toBe('hello world');
    expect(line?.wordCount).toBe(2);
  });

  it('succeeds silently if line already submitted (idempotent)', async () => {
    const t = setupConvexTest();
    const { poemIds } = await seedInProgressGame(t, {
      players: [
        { name: 'Alice', clerkUserId: 'clerk_aliceSL05' },
        { name: 'Bob', clerkUserId: 'clerk_bobSL05' },
      ],
      code: 'SL05',
      currentRound: 0,
    });

    await expect(
      asUser(t, 'aliceSL05').mutation(api.game.submitLine, {
        poemId: poemIds[0],
        lineIndex: 0,
        text: 'hello',
      })
    ).resolves.toEqual({ status: 'committed', text: 'hello' });
    await expect(
      asUser(t, 'aliceSL05').mutation(api.game.submitLine, {
        poemId: poemIds[0],
        lineIndex: 0,
        text: 'different draft',
      })
    ).resolves.toEqual({ status: 'already_submitted', text: 'hello' });

    const lines = await t.run((ctx) =>
      ctx.db
        .query('lines')
        .withIndex('by_poem_index', (q) =>
          q.eq('poemId', poemIds[0]).eq('indexInPoem', 0)
        )
        .collect()
    );
    expect(lines).toHaveLength(1);
  });

  it('throws if user not assigned to this poem', async () => {
    const t = setupConvexTest();
    const { poemIds } = await seedInProgressGame(t, {
      players: [
        { name: 'Alice', clerkUserId: 'clerk_aliceSL06' },
        { name: 'Bob', clerkUserId: 'clerk_bobSL06' },
      ],
      code: 'SL06',
      currentRound: 0,
    });
    // matrix[0][1] = Bob → poem 1; Alice is NOT assigned to poem 1
    await expect(
      asUser(t, 'aliceSL06').mutation(api.game.submitLine, {
        poemId: poemIds[1],
        lineIndex: 0,
        text: 'hello',
      })
    ).rejects.toThrow('Not your turn');
  });

  it('throws if submitting for a future round', async () => {
    const t = setupConvexTest();
    const { poemIds } = await seedInProgressGame(t, {
      players: [
        { name: 'Alice', clerkUserId: 'clerk_aliceSL07' },
        { name: 'Bob', clerkUserId: 'clerk_bobSL07' },
      ],
      code: 'SL07',
      currentRound: 0,
    });
    // Alice at poem 0, round 0; trying lineIndex 1 (future)
    await expect(
      asUser(t, 'aliceSL07').mutation(api.game.submitLine, {
        poemId: poemIds[0],
        lineIndex: 1,
        text: 'hello world',
      })
    ).rejects.toThrow('Round not started yet');
  });

  it('submits line successfully — inserts line with correct fields', async () => {
    const t = setupConvexTest();
    const { poemIds, userIds } = await seedInProgressGame(t, {
      players: [
        { name: 'Alice', clerkUserId: 'clerk_aliceSL08' },
        { name: 'Bob', clerkUserId: 'clerk_bobSL08' },
      ],
      code: 'SL08',
      currentRound: 0,
    });

    await asUser(t, 'aliceSL08').mutation(api.game.submitLine, {
      poemId: poemIds[0],
      lineIndex: 0,
      text: 'hello',
    });

    const line = await t.run((ctx) =>
      ctx.db
        .query('lines')
        .withIndex('by_poem_index', (q) =>
          q.eq('poemId', poemIds[0]).eq('indexInPoem', 0)
        )
        .first()
    );
    expect(line).not.toBeNull();
    expect(line!.text).toBe('hello');
    expect(line!.authorUserId).toBe(userIds[0]);
    expect(line!.wordCount).toBe(1);
  });

  it('advances round when all poems have lines (both players submit)', async () => {
    const t = setupConvexTest();
    const { poemIds, gameId } = await seedInProgressGame(t, {
      players: [
        { name: 'Alice', clerkUserId: 'clerk_aliceSL09' },
        { name: 'Bob', clerkUserId: 'clerk_bobSL09' },
      ],
      code: 'SL09',
      currentRound: 0,
    });

    await asUser(t, 'aliceSL09').mutation(api.game.submitLine, {
      poemId: poemIds[0],
      lineIndex: 0,
      text: 'hello',
    });
    await asUser(t, 'bobSL09').mutation(api.game.submitLine, {
      poemId: poemIds[1],
      lineIndex: 0,
      text: 'world',
    });

    const game = await t.run((ctx) => ctx.db.get(gameId));
    expect(game!.currentRound).toBe(1);
  });

  it('marks room and game completed when humans submit the final round', async () => {
    const t = setupConvexTest();
    const { roomId, gameId, poemIds, matrix } = await seedInProgressGame(t, {
      players: [
        { name: 'Alice', clerkUserId: 'clerk_aliceSL10' },
        { name: 'Bob', clerkUserId: 'clerk_bobSL10' },
      ],
      code: 'SL10',
      currentRound: 8,
    });

    // Fill rounds 0-7 directly with valid lines
    await t.run(async (ctx) => {
      for (let r = 0; r < 8; r++) {
        const wc = WORD_COUNTS[r];
        const words = Array.from({ length: wc }, (_, i) => `w${i}`).join(' ');
        for (let p = 0; p < 2; p++) {
          await ctx.db.insert('lines', {
            poemId: poemIds[p],
            indexInPoem: r,
            text: words,
            wordCount: wc,
            authorUserId: matrix[r][p],
            createdAt: Date.now(),
          });
        }
      }
    });

    // matrix[8][0] = userIds[(0+8)%2] = userIds[0] = Alice → poem 0
    await asUser(t, 'aliceSL10').mutation(api.game.submitLine, {
      poemId: poemIds[0],
      lineIndex: 8,
      text: 'finale',
    });
    // matrix[8][1] = userIds[(1+8)%2] = userIds[1] = Bob → poem 1
    await asUser(t, 'bobSL10').mutation(api.game.submitLine, {
      poemId: poemIds[1],
      lineIndex: 8,
      text: 'ending',
    });

    const game = await t.run((ctx) => ctx.db.get(gameId));
    const room = await t.run((ctx) => ctx.db.get(roomId));

    expect(game?.status).toBe('COMPLETED');
    expect(room?.status).toBe('COMPLETED');

    const poems = await t.run((ctx) =>
      ctx.db
        .query('poems')
        .withIndex('by_game', (q) => q.eq('gameId', gameId))
        .collect()
    );
    expect(poems.every((p) => p.assignedReaderId !== undefined)).toBe(true);
  });
});

// ─── getRevealPhaseState ──────────────────────────────────────────────────────

describe('getRevealPhaseState', () => {
  it('returns null if user not found (no identity)', async () => {
    const t = setupConvexTest();
    const { code } = await seedCompletedRoom(t, 'RV01');

    const result = await t.query(api.game.getRevealPhaseState, {
      roomCode: code,
    });
    expect(result).toBeNull();
  });

  it('returns null if room not found', async () => {
    const t = setupConvexTest();
    await seedClerkUser(t, 'rv02user');

    const result = await asUser(t, 'rv02user').query(
      api.game.getRevealPhaseState,
      {
        roomCode: 'ZZZZ',
      }
    );
    expect(result).toBeNull();
  });

  it('returns null if no completed game', async () => {
    const t = setupConvexTest();
    const { code } = await seedLobby(t, 'RV03');

    const result = await asUser(t, 'hostRV03').query(
      api.game.getRevealPhaseState,
      {
        roomCode: code,
      }
    );
    expect(result).toBeNull();
  });

  it('returns null if user is not a participant', async () => {
    const t = setupConvexTest();
    const { code } = await seedCompletedRoom(t, 'RV04');
    await seedClerkUser(t, 'outsiderRV04');

    const result = await asUser(t, 'outsiderRV04').query(
      api.game.getRevealPhaseState,
      { roomCode: code }
    );
    expect(result).toBeNull();
  });

  it('returns state with no assigned poem when user has no poem assigned', async () => {
    const t = setupConvexTest();
    const { code, hostId, gameId, roomId } = await seedCompletedRoom(t, 'RV05');

    // Poem assigned to host only
    const poemId = await t.run((ctx) =>
      ctx.db.insert('poems', {
        roomId,
        gameId,
        indexInRoom: 0,
        createdAt: 0,
        assignedReaderId: hostId,
      })
    );
    await t.run((ctx) =>
      ctx.db.insert('lines', {
        poemId,
        indexInPoem: 0,
        text: 'opening',
        wordCount: 1,
        authorUserId: hostId,
        createdAt: 0,
      })
    );

    // guestRV05 is a participant but has no poem assigned
    const result = await asUser(t, 'guestRV05').query(
      api.game.getRevealPhaseState,
      { roomCode: code }
    );

    expect(result).not.toBeNull();
    expect(result!.isHost).toBe(false);
    expect(result!.myPoem).toBeNull();
    expect(result!.poems).toHaveLength(1);
  });

  it('returns state with isHost=true when user is host and has an assigned poem', async () => {
    const t = setupConvexTest();
    const { code, hostId, gameId, roomId } = await seedCompletedRoom(t, 'RV06');

    const poemId = await t.run((ctx) =>
      ctx.db.insert('poems', {
        roomId,
        gameId,
        indexInRoom: 0,
        createdAt: 0,
        assignedReaderId: hostId,
      })
    );
    await t.run((ctx) =>
      ctx.db.insert('lines', {
        poemId,
        indexInPoem: 0,
        text: 'opening',
        wordCount: 1,
        authorUserId: hostId,
        createdAt: 0,
      })
    );

    const result = await asUser(t, 'hostRV06').query(
      api.game.getRevealPhaseState,
      {
        roomCode: code,
      }
    );

    expect(result).not.toBeNull();
    expect(result!.isHost).toBe(true);
    expect(result!.poems).toHaveLength(1);
    expect(result!.myPoem).not.toBeNull();
    expect(result!.myPoem!.lines).toBeDefined();
  });

  it('exposes a stale-reader poem only to the deterministic fallback device', async () => {
    const t = setupConvexTest();
    const now = Date.now();
    const stale = now - PRESENCE_AWAY_MS - 1;
    const { code, poemId, readerId } = await seedRevealFallbackRoom(t, 'RV08', {
      host: now,
      reader: stale,
      fallback: now,
    });
    await t.run((ctx) =>
      ctx.db.insert('lines', {
        poemId,
        indexInPoem: 0,
        text: 'opening',
        wordCount: 1,
        authorUserId: readerId,
        createdAt: 0,
      })
    );

    const [hostState, fallbackState] = await Promise.all([
      asUser(t, 'hostRV08').query(api.game.getRevealPhaseState, {
        roomCode: code,
      }),
      asUser(t, 'fallbackRV08').query(api.game.getRevealPhaseState, {
        roomCode: code,
      }),
    ]);

    expect(hostState?.myPoem).toMatchObject({
      _id: poemId,
      canReveal: true,
      isFallbackReader: true,
      readerName: 'readerRV08',
    });
    expect(hostState?.myPoem?.lines.map((line) => line.text)).toEqual([
      'opening',
    ]);
    expect(fallbackState?.myPoem).toBeNull();
    expect(fallbackState?.poems[0]).toMatchObject({
      _id: poemId,
      canReveal: false,
      isFallbackReader: false,
    });

    await asUser(t, 'hostRV08').mutation(api.game.revealPoem, { poemId });
    const hostStateAfterReveal = await asUser(t, 'hostRV08').query(
      api.game.getRevealPhaseState,
      { roomCode: code }
    );
    expect(hostStateAfterReveal?.myPoem).toBeNull();
    expect(hostStateAfterReveal?.revealedPoems).toEqual([
      expect.objectContaining({ _id: poemId, isRevealed: true }),
    ]);
  });

  it('returns full lines for revealed poems without leaking unrevealed poems', async () => {
    const t = setupConvexTest();
    const { code, hostId, guestId, gameId, roomId } = await seedCompletedRoom(
      t,
      'RV07'
    );

    const [revealedPoemId, hiddenPoemId] = await t.run(async (ctx) => {
      const revealedId = await ctx.db.insert('poems', {
        roomId,
        gameId,
        indexInRoom: 0,
        createdAt: 0,
        assignedReaderId: guestId,
        revealedAt: 1234,
      });
      const hiddenId = await ctx.db.insert('poems', {
        roomId,
        gameId,
        indexInRoom: 1,
        createdAt: 0,
        assignedReaderId: guestId,
      });

      await Promise.all([
        ctx.db.insert('lines', {
          poemId: revealedId,
          indexInPoem: 0,
          text: 'First',
          wordCount: 1,
          authorUserId: hostId,
          authorDisplayName: 'Host Pen',
          createdAt: 0,
        }),
        ctx.db.insert('lines', {
          poemId: revealedId,
          indexInPoem: 1,
          text: 'Second line',
          wordCount: 2,
          authorUserId: guestId,
          authorDisplayName: 'Guest Pen',
          createdAt: 0,
        }),
        ctx.db.insert('lines', {
          poemId: hiddenId,
          indexInPoem: 0,
          text: 'Hidden',
          wordCount: 1,
          authorUserId: guestId,
          authorDisplayName: 'Hidden Pen',
          createdAt: 0,
        }),
      ]);

      return [revealedId, hiddenId];
    });

    const result = await asUser(t, 'hostRV07').query(
      api.game.getRevealPhaseState,
      {
        roomCode: code,
      }
    );

    expect(result).not.toBeNull();
    expect(result!.myPoems).toHaveLength(0);
    expect(result!.revealedPoems).toHaveLength(1);
    expect(result!.revealedPoems[0]).toMatchObject({
      _id: revealedPoemId,
      readerName: 'GuestRV07',
      isRevealed: true,
      revealedAt: 1234,
    });
    expect(result!.revealedPoems[0].lines.map((line) => line.text)).toEqual([
      'First',
      'Second line',
    ]);
    expect(
      result!.revealedPoems[0].lines.map((line) => line.authorName)
    ).toEqual(['Host Pen', 'Guest Pen']);
    expect(
      result!.revealedPoems.some((poem) => poem._id === hiddenPoemId)
    ).toBe(false);
  });
});

// ─── revealPoem ───────────────────────────────────────────────────────────────

describe('revealPoem', () => {
  it('rejects fallback reveal attempts before the game is complete', async () => {
    const t = setupConvexTest();
    const { poemIds, roomId, userIds } = await seedInProgressGame(t, {
      code: 'RP00',
      players: [
        { name: 'Host', clerkUserId: 'clerk_hostRP00' },
        { name: 'Guest', clerkUserId: 'clerk_guestRP00' },
      ],
    });
    await t.run(async (ctx) => {
      const hostPlayer = await ctx.db
        .query('roomPlayers')
        .withIndex('by_room_user', (q) =>
          q.eq('roomId', roomId).eq('userId', userIds[0])
        )
        .unique();
      if (!hostPlayer) throw new Error('Seeded host player missing');
      await ctx.db.patch(hostPlayer._id, { lastSeenAt: Date.now() });
    });

    await expect(
      asUser(t, 'hostRP00').mutation(api.game.revealPoem, {
        poemId: poemIds[0],
      })
    ).rejects.toThrow('Poem is not ready to reveal');
  });

  it('reveals poem successfully — sets revealedAt timestamp', async () => {
    const t = setupConvexTest();
    const { hostId, gameId, roomId } = await seedCompletedRoom(t, 'RP01');

    const poemId = await t.run((ctx) =>
      ctx.db.insert('poems', {
        roomId,
        gameId,
        indexInRoom: 0,
        createdAt: 0,
        assignedReaderId: hostId,
      })
    );

    await asUser(t, 'hostRP01').mutation(api.game.revealPoem, { poemId });

    const poem = await t.run((ctx) => ctx.db.get(poemId));
    expect(poem?.revealedAt).toBeDefined();
    expect(typeof poem?.revealedAt).toBe('number');
  });

  it('throws if user not found (no identity)', async () => {
    const t = setupConvexTest();
    const { hostId, gameId, roomId } = await seedCompletedRoom(t, 'RP02');

    const poemId = await t.run((ctx) =>
      ctx.db.insert('poems', {
        roomId,
        gameId,
        indexInRoom: 0,
        createdAt: 0,
        assignedReaderId: hostId,
      })
    );

    await expect(t.mutation(api.game.revealPoem, { poemId })).rejects.toThrow(
      'User not found'
    );
  });

  it('throws if poem not found', async () => {
    const t = setupConvexTest();
    const { gameId, roomId } = await seedCompletedRoom(t, 'RP03');
    await seedClerkUser(t, 'rp03user');

    // Insert a poem, capture its id, then delete it — the id is now a valid
    // poem-shaped id with no matching row, which triggers "Poem not found".
    const ghostPoemId = await t.run(async (ctx) => {
      const id = await ctx.db.insert('poems', {
        roomId,
        gameId,
        indexInRoom: 99,
        createdAt: 0,
      });
      await ctx.db.delete(id);
      return id;
    });

    await expect(
      asUser(t, 'rp03user').mutation(api.game.revealPoem, {
        poemId: ghostPoemId,
      })
    ).rejects.toThrow('Poem not found');
  });

  it('throws if poem not assigned to user', async () => {
    const t = setupConvexTest();
    const { hostId, gameId, roomId } = await seedCompletedRoom(t, 'RP04');

    // Assigned to host, reveal attempt by guest
    const poemId = await t.run((ctx) =>
      ctx.db.insert('poems', {
        roomId,
        gameId,
        indexInRoom: 0,
        createdAt: 0,
        assignedReaderId: hostId,
      })
    );

    await expect(
      asUser(t, 'guestRP04').mutation(api.game.revealPoem, { poemId })
    ).rejects.toThrow('This poem is not assigned to you');
  });

  it('treats an already revealed poem as an idempotent success', async () => {
    const t = setupConvexTest();
    const { hostId, gameId, roomId } = await seedCompletedRoom(t, 'RP05');

    const poemId = await t.run((ctx) =>
      ctx.db.insert('poems', {
        roomId,
        gameId,
        indexInRoom: 0,
        createdAt: 0,
        assignedReaderId: hostId,
        revealedAt: 1234567890,
      })
    );

    await expect(
      asUser(t, 'hostRP05').mutation(api.game.revealPoem, { poemId })
    ).resolves.toEqual({ revealed: false });
  });

  it('keeps reveal agency exclusive to a present assigned reader', async () => {
    const t = setupConvexTest();
    const now = Date.now();
    const { poemId } = await seedRevealFallbackRoom(t, 'RP06', {
      host: now,
      reader: now,
      fallback: now,
    });

    await expect(
      asUser(t, 'hostRP06').mutation(api.game.revealPoem, { poemId })
    ).rejects.toThrow('This poem is not assigned to you');
  });

  it('lets the present host reveal for a stale reader idempotently', async () => {
    const t = setupConvexTest();
    const now = Date.now();
    const stale = now - PRESENCE_AWAY_MS - 1;
    const { poemId } = await seedRevealFallbackRoom(t, 'RP07', {
      host: now,
      reader: stale,
      fallback: now,
    });

    await expect(
      asUser(t, 'hostRP07').mutation(api.game.revealPoem, { poemId })
    ).resolves.toEqual({ revealed: true });
    await expect(
      asUser(t, 'hostRP07').mutation(api.game.revealPoem, { poemId })
    ).resolves.toEqual({ revealed: false });

    const poem = await t.run((ctx) => ctx.db.get(poemId));
    expect(poem?.revealedAt).toBeDefined();
  });

  it('becomes recoverable when one participant returns to an empty reveal', async () => {
    const t = setupConvexTest();
    const stale = Date.now() - PRESENCE_AWAY_MS - 1;
    const { code, poemId } = await seedRevealFallbackRoom(t, 'RP08', {
      host: stale,
      reader: stale,
      fallback: stale,
    });

    await expect(
      asUser(t, 'fallbackRP08').mutation(api.game.revealPoem, { poemId })
    ).rejects.toThrow('This poem is not assigned to you');

    await asUser(t, 'fallbackRP08').mutation(api.presence.heartbeat, {
      roomCode: code,
    });

    await expect(
      asUser(t, 'fallbackRP08').mutation(api.game.revealPoem, { poemId })
    ).resolves.toEqual({ revealed: true });
  });
});

// ─── getRoundProgress ─────────────────────────────────────────────────────────

describe('getRoundProgress', () => {
  it('returns null when user not authenticated (no identity)', async () => {
    const t = setupConvexTest();
    await seedInProgressGame(t, {
      players: [{ name: 'A' }, { name: 'B' }],
      code: 'GP01',
    });

    const result = await t.query(api.game.getRoundProgress, {
      roomCode: 'GP01',
    });
    expect(result).toBeNull();
  });

  it('returns null when room not found', async () => {
    const t = setupConvexTest();
    await seedClerkUser(t, 'gp02user');

    const result = await asUser(t, 'gp02user').query(
      api.game.getRoundProgress,
      {
        roomCode: 'ZZZZ',
      }
    );
    expect(result).toBeNull();
  });

  it('returns null when user is not a participant', async () => {
    const t = setupConvexTest();
    await seedInProgressGame(t, {
      players: [
        { name: 'Alice', clerkUserId: 'clerk_aliceGP03' },
        { name: 'Bob', clerkUserId: 'clerk_bobGP03' },
      ],
      code: 'GP03',
    });
    await seedClerkUser(t, 'outsiderGP03');

    const result = await asUser(t, 'outsiderGP03').query(
      api.game.getRoundProgress,
      { roomCode: 'GP03' }
    );
    expect(result).toBeNull();
  });

  it('returns null when no active game', async () => {
    const t = setupConvexTest();
    const { code } = await seedLobby(t, 'GP04');

    const result = await asUser(t, 'hostGP04').query(
      api.game.getRoundProgress,
      {
        roomCode: code,
      }
    );
    expect(result).toBeNull();
  });

  it('returns progress with submitted and isAway fields (not raw lastSeenAt)', async () => {
    const t = setupConvexTest();
    const { poemIds, userIds } = await seedInProgressGame(t, {
      players: [
        { name: 'Alice', clerkUserId: 'clerk_aliceGP05' },
        { name: 'Bob', clerkUserId: 'clerk_bobGP05' },
      ],
      code: 'GP05',
      currentRound: 0,
    });

    // Alice submits; Bob hasn't yet
    await asUser(t, 'aliceGP05').mutation(api.game.submitLine, {
      poemId: poemIds[0],
      lineIndex: 0,
      text: 'hello',
    });

    const result = await asUser(t, 'aliceGP05').query(
      api.game.getRoundProgress,
      {
        roomCode: 'GP05',
      }
    );

    expect(result).not.toBeNull();
    expect(result!.round).toBe(0);
    expect(result!.players).toHaveLength(2);
    expect(result!.isCurrentUserSpectator).toBe(false);

    const alice = result!.players.find((p) => p.userId === userIds[0]);
    const bob = result!.players.find((p) => p.userId === userIds[1]);

    expect(alice?.submitted).toBe(true);
    expect(bob?.submitted).toBe(false);

    // isAway must be present; raw lastSeenAt must NOT appear in the shape
    expect(typeof alice?.isAway).toBe('boolean');
    expect(typeof bob?.isAway).toBe('boolean');
    expect((alice as Record<string, unknown>)['lastSeenAt']).toBeUndefined();
  });

  it('marks a late arrival as a spectator outside the active matrix', async () => {
    const t = setupConvexTest();
    const { roomId } = await seedInProgressGame(t, {
      players: [
        { name: 'Alice', clerkUserId: 'clerk_aliceGP07' },
        { name: 'Bob', clerkUserId: 'clerk_bobGP07' },
      ],
      code: 'GP07',
      currentRound: 3,
    });
    const lateId = await seedClerkUser(t, 'lateGP07', {
      displayName: 'Late',
    });
    await t.run((ctx) =>
      ctx.db.insert('roomPlayers', {
        roomId,
        userId: lateId,
        displayName: 'Late',
        joinedAt: Date.now(),
      })
    );

    const result = await asUser(t, 'lateGP07').query(
      api.game.getRoundProgress,
      { roomCode: 'GP07' }
    );

    const late = result?.players.find((p) => p.userId === lateId);
    expect(late?.isSpectator).toBe(true);
    expect(result?.isCurrentUserSpectator).toBe(true);
    expect(result?.players.filter((p) => !p.isSpectator)).toHaveLength(2);
  });

  it("reports a legacy short-matrix game's own round count", async () => {
    const t = setupConvexTest();
    // A pre-consolidation game shipped a 5-round matrix; getRoundProgress must
    // report 5 (the matrix length), not the 9-round one-game shape.
    await seedInProgressGame(t, {
      players: [
        { name: 'Alice', clerkUserId: 'clerk_aliceGP06' },
        { name: 'Bob', clerkUserId: 'clerk_bobGP06' },
      ],
      code: 'GP06',
      currentRound: 0,
      rounds: 5,
    });

    const result = await asUser(t, 'aliceGP06').query(
      api.game.getRoundProgress,
      {
        roomCode: 'GP06',
      }
    );

    expect(result).not.toBeNull();
    expect(result!.totalRounds).toBe(5);
  });
});
