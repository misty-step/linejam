/**
 * Coverage for fillStaleHumanTurns ROUTING on the real convex-test engine
 * (backlog 018 migration off mock DB).
 *
 * Each test asserts observable DB outcomes — ghost lines written (or not) in
 * the `lines` table — rather than scheduler call-count stubs. The routing
 * decisions under test:
 *   - human-assigned poem missing its line → ghost line scheduled → line lands
 *   - AI-assigned poem missing its line → skipped (not ghost-filled by this path)
 *   - poem already has a line → untouched
 *   - game is not IN_PROGRESS → no-op
 *   - round argument is stale (game advanced past it) → no-op
 *
 * The only mocked boundary is the OpenRouter `fetch`, stubbed offline so
 * generateGhostLine falls through to the deterministic fallback. No internal
 * modules are mocked.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { internal } from '../../convex/_generated/api';
import type { Doc, Id } from '../../convex/_generated/dataModel';
import { setupConvexTest } from '../helpers/convexTest';
import { type T, getAllLines } from '../helpers/convexSeed';
import { WORD_COUNTS, AUTO_GHOST_FILL_MS } from '../../convex/lib/gameRules';

type SeedPlayer = {
  name: string;
  kind?: 'AI' | 'human';
};

type Seeded = {
  roomId: Id<'rooms'>;
  gameId: Id<'games'>;
  userIds: Id<'users'>[];
  poemIds: Id<'poems'>[];
  matrix: Id<'users'>[][];
};

/**
 * Seed an IN_PROGRESS classic game directly.
 * Assignment matrix: cyclic shift — round R assigns poem P to user[(P+R) % N].
 * This satisfies the "no player writes the same poem twice in a row" invariant
 * and is fully deterministic.
 */
async function seedGame(
  t: T,
  opts: {
    players: SeedPlayer[];
    currentRound?: number;
    status?: 'IN_PROGRESS' | 'COMPLETED';
  }
): Promise<Seeded> {
  const now = Date.now();
  const currentRound = opts.currentRound ?? 0;
  const status = opts.status ?? 'IN_PROGRESS';
  const rounds = WORD_COUNTS.length;

  return t.run(async (ctx) => {
    const userIds: Id<'users'>[] = [];
    for (const p of opts.players) {
      userIds.push(
        await ctx.db.insert('users', {
          displayName: p.name,
          kind: p.kind ?? 'human',
          createdAt: now,
        })
      );
    }

    const roomId = await ctx.db.insert('rooms', {
      code: 'ABCD',
      hostUserId: userIds[0],
      status,
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
          lastSeenAt: now,
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
      status,
      cycle: 1,
      currentRound,
      roundStartedAt: now,
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

    return { roomId, gameId, userIds, poemIds, matrix };
  });
}

/** Lines for a specific poem at a specific round index. */
function getLinesForRound(
  t: T,
  poemId: Id<'poems'>,
  round: number
): Promise<Doc<'lines'>[]> {
  return t.run((ctx) =>
    ctx.db
      .query('lines')
      .withIndex('by_poem_index', (q) =>
        q.eq('poemId', poemId).eq('indexInPoem', round)
      )
      .collect()
  );
}

beforeEach(() => {
  // Stub OpenRouter offline so generateGhostLine falls through to the
  // deterministic fallback — no network in tests.
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('network disabled in test')))
  );
  // Fake timers drive the durable scheduler (setTimeout-backed runAfter).
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('fillStaleHumanTurns routing (convex-test, real DB + scheduler)', () => {
  it('writes ghost lines for both human poems when both are missing', async () => {
    const t = setupConvexTest();
    const { gameId, roomId } = await seedGame(t, {
      players: [{ name: 'Ada' }, { name: 'Bo' }],
      currentRound: 0,
    });

    // Schedule the fill exactly as startGame does.
    await t.run((ctx) =>
      ctx.scheduler.runAfter(
        AUTO_GHOST_FILL_MS,
        internal.game.fillStaleHumanTurns,
        { roomId, gameId, round: 0 }
      )
    );
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const round0Lines = (await getAllLines(t, gameId)).filter(
      (l) => l.indexInPoem === 0
    );
    // Both human poems must have received ghost lines.
    expect(round0Lines).toHaveLength(2);
    const names = round0Lines.map((l) => l.authorDisplayName).sort();
    expect(names).toEqual(['Ada (ghost)', 'Bo (ghost)']);
  });

  it('is a no-op when all round lines already exist', async () => {
    const t = setupConvexTest();
    const { gameId, roomId, poemIds, matrix } = await seedGame(t, {
      players: [{ name: 'Ada' }, { name: 'Bo' }],
      currentRound: 0,
    });

    // Pre-write round-0 lines for both poems directly.
    await t.run(async (ctx) => {
      for (let i = 0; i < poemIds.length; i++) {
        await ctx.db.insert('lines', {
          poemId: poemIds[i],
          indexInPoem: 0,
          text: 'already',
          wordCount: WORD_COUNTS[0],
          authorUserId: matrix[0][i],
          authorDisplayName: i === 0 ? 'Ada' : 'Bo',
          createdAt: Date.now(),
        });
      }
    });

    await t.run((ctx) =>
      ctx.scheduler.runAfter(
        AUTO_GHOST_FILL_MS,
        internal.game.fillStaleHumanTurns,
        { roomId, gameId, round: 0 }
      )
    );
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const lines = await getAllLines(t, gameId);
    // Still exactly 2 lines — no ghost duplicates.
    expect(lines.filter((l) => l.indexInPoem === 0)).toHaveLength(2);
    // Original text untouched.
    expect(lines.every((l) => l.text === 'already')).toBe(true);
  });

  it('skips AI-assigned poems and only fills the human poem', async () => {
    const t = setupConvexTest();
    // Cyclic matrix for round 0: poem[i] → user[(i+0) % 2]
    //   poem 0 → user[0] = Ada (human)
    //   poem 1 → user[1] = GeminiBot (AI)
    const { gameId, roomId, poemIds } = await seedGame(t, {
      players: [
        { name: 'Ada', kind: 'human' },
        { name: 'GeminiBot', kind: 'AI' },
      ],
      currentRound: 0,
    });

    await t.run((ctx) =>
      ctx.scheduler.runAfter(
        AUTO_GHOST_FILL_MS,
        internal.game.fillStaleHumanTurns,
        { roomId, gameId, round: 0 }
      )
    );
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const linesPoem0 = await getLinesForRound(t, poemIds[0], 0);
    const linesPoem1 = await getLinesForRound(t, poemIds[1], 0);

    // Ada's poem (human-assigned, round 0) gets a ghost line from fillStaleHumanTurns.
    expect(linesPoem0).toHaveLength(1);
    expect(linesPoem0[0].authorDisplayName).toBe('Ada (ghost)');

    // AI-assigned poem (poem 1): fillStaleHumanTurns must NOT write a ghost line
    // for round 0. The AI player writes its own turns via generateAiTurn (a
    // separate path). Round 0 of poem 1 must have been written by the AI player,
    // not ghost-bylined by the human-floor path.
    // After draining all functions the AI will have written poem 1 via its own path.
    expect(linesPoem1).toHaveLength(1);
    expect(linesPoem1[0].authorDisplayName).not.toMatch(/\(ghost\)$/);
  });

  it('is a no-op when the game status is COMPLETED', async () => {
    const t = setupConvexTest();
    const { gameId, roomId } = await seedGame(t, {
      players: [{ name: 'Ada' }, { name: 'Bo' }],
      status: 'COMPLETED',
      currentRound: 0,
    });

    await t.run((ctx) =>
      ctx.scheduler.runAfter(
        AUTO_GHOST_FILL_MS,
        internal.game.fillStaleHumanTurns,
        { roomId, gameId, round: 0 }
      )
    );
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const lines = await getAllLines(t, gameId);
    expect(lines).toHaveLength(0);
  });

  it('is a no-op when the round argument is stale (game advanced past it)', async () => {
    const t = setupConvexTest();
    const { gameId, roomId } = await seedGame(t, {
      players: [{ name: 'Ada' }, { name: 'Bo' }],
      currentRound: 2, // game is now on round 2
    });

    // Schedule the fill for round 1 (stale — game already moved to round 2).
    await t.run((ctx) =>
      ctx.scheduler.runAfter(
        AUTO_GHOST_FILL_MS,
        internal.game.fillStaleHumanTurns,
        { roomId, gameId, round: 1 }
      )
    );
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    // No lines should have been written for round 1.
    const lines = await getAllLines(t, gameId);
    const round1Lines = lines.filter((l) => l.indexInPoem === 1);
    expect(round1Lines).toHaveLength(0);
  });

  it('leaves an already-written line untouched when only one poem is missing', async () => {
    const t = setupConvexTest();
    const { gameId, roomId, poemIds, userIds } = await seedGame(t, {
      players: [{ name: 'Ada' }, { name: 'Bo' }],
      currentRound: 0,
    });

    // Ada already wrote her round-0 line (poem 0 is assigned to Ada in round 0).
    const adaUserId = userIds[0]; // user[0+0 % 2] = user[0] = Ada for poem 0
    await t.run((ctx) =>
      ctx.db.insert('lines', {
        poemId: poemIds[0],
        indexInPoem: 0,
        text: 'the original',
        wordCount: WORD_COUNTS[0],
        authorUserId: adaUserId,
        authorDisplayName: 'Ada',
        createdAt: Date.now(),
      })
    );

    await t.run((ctx) =>
      ctx.scheduler.runAfter(
        AUTO_GHOST_FILL_MS,
        internal.game.fillStaleHumanTurns,
        { roomId, gameId, round: 0 }
      )
    );
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    // Ada's line is untouched.
    const adaLines = await getLinesForRound(t, poemIds[0], 0);
    expect(adaLines).toHaveLength(1);
    expect(adaLines[0].text).toBe('the original');
    expect(adaLines[0].authorDisplayName).toBe('Ada');

    // Bo's poem (poem 1) was missing — it should now have a ghost line.
    const boLines = await getLinesForRound(t, poemIds[1], 0);
    expect(boLines).toHaveLength(1);
    expect(boLines[0].authorDisplayName).toBe('Bo (ghost)');
  });
});
