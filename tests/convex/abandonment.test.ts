import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { api, internal } from '../../convex/_generated/api';
import type { Doc, Id } from '../../convex/_generated/dataModel';
import { setupConvexTest } from '../helpers/convexTest';
import {
  ABANDONMENT_HARD_DEADLINE_MS,
  ABANDONMENT_THRESHOLD_MS,
  AUTO_GHOST_FILL_MS,
  GHOSTWRITER_OVERTIME_MS,
  WORD_COUNTS,
} from '../../convex/lib/gameRules';
import { getFallbackLine } from '../../convex/lib/ai/fallbacks';
import { countWords } from '../../convex/lib/wordCount';

/**
 * Integration coverage for "never let the room die" (backlog 016, children 3-5).
 *
 * Runs against convex-test's real query engine + scheduler — not the mock DB —
 * because the invariant under test is a multi-round completion chain
 * (commit line → lifecycle transition → advance → repeat → COMPLETED) that only
 * a real read-your-writes backend exercises. The only mocked boundary is the
 * OpenRouter `fetch`, stubbed offline so the safety nets are deterministic and
 * so we can simulate a total LLM outage. Fake timers drive the durable
 * scheduler; `finishAllScheduledFunctions` drains every `runAfter` chain.
 */

type T = ReturnType<typeof setupConvexTest>;

/** A timestamp comfortably past the abandonment threshold (fake clock). */
const staleStamp = () => Date.now() - ABANDONMENT_THRESHOLD_MS - 60_000;

/** A timestamp past the absolute hard-deadline backstop (fake clock). */
const deadlineStamp = () => Date.now() - ABANDONMENT_HARD_DEADLINE_MS - 60_000;

type SeedPlayer = {
  name: string;
  kind?: 'AI' | 'human';
  clerkUserId?: string;
  lastSeenAt?: number;
};

type Seeded = {
  roomId: Id<'rooms'>;
  gameId: Id<'games'>;
  userIds: Id<'users'>[];
  poemIds: Id<'poems'>[];
  matrix: Id<'users'>[][];
};

/**
 * Seed an IN_PROGRESS classic game directly (bypassing auth/lobby plumbing).
 * The assignment matrix is a deterministic cyclic shift: every round is a full
 * permutation and no player writes the same poem twice in a row — the real
 * matrix invariant, without the randomness.
 */
async function seedClassicGame(
  t: T,
  opts: {
    players: SeedPlayer[];
    currentRound?: number;
    roundStartedAt?: number;
    createdAt?: number;
  }
): Promise<Seeded> {
  const createdAt = opts.createdAt ?? Date.now();
  const currentRound = opts.currentRound ?? 0;
  const rounds = WORD_COUNTS.length;

  return t.run(async (ctx) => {
    const userIds: Id<'users'>[] = [];
    for (const p of opts.players) {
      userIds.push(
        await ctx.db.insert('users', {
          displayName: p.name,
          kind: p.kind ?? 'human',
          ...(p.clerkUserId ? { clerkUserId: p.clerkUserId } : {}),
          createdAt,
        })
      );
    }

    const roomId = await ctx.db.insert('rooms', {
      code: 'ABCD',
      hostUserId: userIds[0],
      status: 'IN_PROGRESS',
      createdAt,
    });

    await Promise.all(
      opts.players.map((p, i) =>
        ctx.db.insert('roomPlayers', {
          roomId,
          userId: userIds[i],
          displayName: p.name,
          seatIndex: i,
          joinedAt: createdAt,
          lastSeenAt: p.lastSeenAt,
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
      roundStartedAt: opts.roundStartedAt ?? createdAt,
      assignmentMatrix: matrix,
      createdAt,
    });

    const poemIds: Id<'poems'>[] = [];
    for (let i = 0; i < n; i++) {
      poemIds.push(
        await ctx.db.insert('poems', {
          roomId,
          gameId,
          indexInRoom: i,
          createdAt,
        })
      );
    }

    return { roomId, gameId, userIds, poemIds, matrix };
  });
}

function getAllLines(t: T, gameId: Id<'games'>): Promise<Doc<'lines'>[]> {
  return t.run(async (ctx) => {
    const poems = await ctx.db
      .query('poems')
      .withIndex('by_game', (q) => q.eq('gameId', gameId))
      .collect();
    const perPoem = await Promise.all(
      poems.map((poem) =>
        ctx.db
          .query('lines')
          .withIndex('by_poem', (q) => q.eq('poemId', poem._id))
          .collect()
      )
    );
    return perPoem.flat();
  });
}

beforeEach(() => {
  // Simulate OpenRouter being unreachable. generateLine() catches this and
  // returns a deterministic fallback, so every machine-written line is
  // predictable and no test touches the network.
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('network disabled in test')))
  );
  // The durable scheduler runs on setTimeout; fake timers let us drive it.
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('per-turn auto ghost-fill (child 2 / oracle 5a)', () => {
  it('auto-fills a disconnected human turn once the timeout floor fires', async () => {
    // The floor fires no later than the host can summon the ghostwriter.
    expect(AUTO_GHOST_FILL_MS).toBeLessThanOrEqual(GHOSTWRITER_OVERTIME_MS);

    const t = setupConvexTest();
    const { gameId, roomId } = await seedClassicGame(t, {
      players: [{ name: 'Ada' }, { name: 'Bo' }],
      currentRound: 0,
    });

    // startGame schedules exactly this floor at AUTO_GHOST_FILL_MS. Nobody has
    // written; both turns belong to (now disconnected) humans.
    await t.run((ctx) =>
      ctx.scheduler.runAfter(
        AUTO_GHOST_FILL_MS,
        internal.game.fillStaleHumanTurns,
        { roomId, gameId, round: 0 }
      )
    );
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const round0 = (await getAllLines(t, gameId)).filter(
      (l) => l.indexInPoem === 0
    );
    expect(round0).toHaveLength(2);
    // Honest attribution: ghost-filled human turns are bylined "<name> (ghost)".
    expect(round0.map((l) => l.authorDisplayName).sort()).toEqual([
      'Ada (ghost)',
      'Bo (ghost)',
    ]);
    // The floor self-perpetuates and carries the room to reveal.
    const game = await t.run((ctx) => ctx.db.get(gameId));
    expect(game?.status).toBe('COMPLETED');
  });
});

describe('abandonment cron (child 3 / oracle 5b)', () => {
  it('sweeps an all-humans-stale game and finishes it to COMPLETED', async () => {
    const t = setupConvexTest();
    const { gameId, roomId } = await seedClassicGame(t, {
      players: [
        { name: 'Ada', lastSeenAt: staleStamp() },
        { name: 'Bo', lastSeenAt: staleStamp() },
      ],
      roundStartedAt: staleStamp(),
      createdAt: staleStamp(),
    });

    // End to end: the cron detects, schedules, and the worker completes.
    const sweep = await t.mutation(
      internal.abandonment.sweepAbandonedGames,
      {}
    );
    expect(sweep).toEqual({ scheduled: 1, scanned: 1 });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const game = await t.run((ctx) => ctx.db.get(gameId));
    const room = await t.run((ctx) => ctx.db.get(roomId));
    expect(game?.status).toBe('COMPLETED');
    expect(room?.status).toBe('COMPLETED');
    expect(game?.completedAt).toBeDefined();

    // Every line of every poem is present (9 rounds x 2 poems), honestly
    // bylined, and word-count valid.
    const lines = await getAllLines(t, gameId);
    expect(lines).toHaveLength(WORD_COUNTS.length * 2);
    for (const line of lines) {
      expect(line.authorDisplayName).toMatch(/ \(ghost\)$/);
      expect(line.wordCount).toBe(WORD_COUNTS[line.indexInPoem]);
    }
    // Reveal is reachable: every poem has a reader assigned.
    const poems = await t.run((ctx) =>
      ctx.db
        .query('poems')
        .withIndex('by_game', (q) => q.eq('gameId', gameId))
        .collect()
    );
    expect(poems.every((p) => p.assignedReaderId !== undefined)).toBe(true);
  });

  it('does not fire while any human is still present', async () => {
    const t = setupConvexTest();
    await seedClassicGame(t, {
      players: [
        { name: 'Ada', lastSeenAt: staleStamp() },
        { name: 'Bo', lastSeenAt: Date.now() }, // still here
      ],
      roundStartedAt: staleStamp(),
      createdAt: staleStamp(),
    });

    const sweep = await t.mutation(
      internal.abandonment.sweepAbandonedGames,
      {}
    );
    expect(sweep).toEqual({ scheduled: 0, scanned: 1 });
  });

  it('does not fire on a fresh game even when nobody has heartbeat yet', async () => {
    const t = setupConvexTest();
    // No lastSeenAt at all (legacy / pre-presence clients), but the round just
    // opened — the idle-age index range excludes it, so it isn't even scanned.
    await seedClassicGame(t, {
      players: [{ name: 'Ada' }, { name: 'Bo' }],
      roundStartedAt: Date.now(),
      createdAt: Date.now(),
    });

    const sweep = await t.mutation(
      internal.abandonment.sweepAbandonedGames,
      {}
    );
    expect(sweep).toEqual({ scheduled: 0, scanned: 0 });
  });

  it('does not fire on an idle game whose humans never established presence', async () => {
    const t = setupConvexTest();
    // The dangerous rollout case: the round is idle past the threshold AND no
    // human has ever heartbeat (old client bundle). "Never heartbeat" must read
    // as unknown, not abandoned — only the per-turn floor may touch it.
    await seedClassicGame(t, {
      players: [{ name: 'Ada' }, { name: 'Bo' }],
      roundStartedAt: staleStamp(),
      createdAt: staleStamp(),
    });

    const sweep = await t.mutation(
      internal.abandonment.sweepAbandonedGames,
      {}
    );
    expect(sweep).toEqual({ scheduled: 0, scanned: 1 });
  });

  it('refuses a duplicate line when two fills race the same round', async () => {
    const t = setupConvexTest();
    const { gameId, roomId, userIds, poemIds, matrix } = await seedClassicGame(
      t,
      { players: [{ name: 'Ada' }, { name: 'Bo' }], currentRound: 0 }
    );
    const adaPoem = poemIds[matrix[0].indexOf(userIds[0])];
    const fill = {
      poemId: adaPoem,
      lineIndex: 0,
      forUserId: userIds[0],
      roomId,
      gameId,
    };

    // Two overlapping fills land on the same (poem, round) of a live game — the
    // production race between the cron finisher and the per-turn floor. The
    // commitAssignedLine existing-line guard must drop the second.
    await t.mutation(internal.ai.commitGhostLine, { ...fill, text: 'first' });
    await t.mutation(internal.ai.commitGhostLine, { ...fill, text: 'second' });

    const adaRound0 = (await getAllLines(t, gameId)).filter(
      (l) => l.poemId === adaPoem && l.indexInPoem === 0
    );
    expect(adaRound0).toHaveLength(1);
    expect(adaRound0[0].text).toBe('first'); // the first write won; no clobber
  });

  it('is idempotent under repeated firing', async () => {
    const t = setupConvexTest();
    const { gameId } = await seedClassicGame(t, {
      players: [
        { name: 'Ada', lastSeenAt: staleStamp() },
        { name: 'Bo', lastSeenAt: staleStamp() },
      ],
      roundStartedAt: staleStamp(),
      createdAt: staleStamp(),
    });

    const first = await t.mutation(internal.abandonment.finishAbandonedGame, {
      gameId,
    });
    expect(first.completed).toBe(true);
    const linesAfterFirst = await getAllLines(t, gameId);

    // Re-firing the finisher and the sweep must not double-write or throw.
    const second = await t.mutation(internal.abandonment.finishAbandonedGame, {
      gameId,
    });
    expect(second).toEqual({ completed: false, filled: 0 });
    const sweep = await t.mutation(
      internal.abandonment.sweepAbandonedGames,
      {}
    );
    expect(sweep.scheduled).toBe(0); // already COMPLETED, not IN_PROGRESS

    const linesAfterSecond = await getAllLines(t, gameId);
    expect(linesAfterSecond).toHaveLength(linesAfterFirst.length);
  });

  it('does not fire on a long-idle game while a human is still present', async () => {
    const t = setupConvexTest();
    // Past the hard deadline, but a human is actively heartbeating. Presence
    // wins over idle-age: the room is not abandoned and must not be scheduled
    // (otherwise the finisher only bails, wasting a slot every tick).
    await seedClassicGame(t, {
      players: [
        { name: 'Ada', lastSeenAt: Date.now() }, // present
        { name: 'Bo', lastSeenAt: staleStamp() },
      ],
      roundStartedAt: deadlineStamp(),
      createdAt: deadlineStamp(),
    });

    const sweep = await t.mutation(
      internal.abandonment.sweepAbandonedGames,
      {}
    );
    expect(sweep).toEqual({ scheduled: 0, scanned: 1 });
  });

  it('schedules every idle abandoned game it scans', async () => {
    const t = setupConvexTest();
    for (let i = 0; i < 3; i++) {
      await seedClassicGame(t, {
        players: [
          { name: `Ada${i}`, lastSeenAt: staleStamp() },
          { name: `Bo${i}`, lastSeenAt: staleStamp() },
        ],
        roundStartedAt: staleStamp(),
        createdAt: staleStamp(),
      });
    }

    const sweep = await t.mutation(
      internal.abandonment.sweepAbandonedGames,
      {}
    );
    expect(sweep).toEqual({ scheduled: 3, scanned: 3 });
  });

  it('excludes still-active games from the scan so they cannot starve abandoned ones', async () => {
    const t = setupConvexTest();
    // Several fresh, actively-advancing games (recent roundStartedAt) plus one
    // genuinely abandoned game seeded last. The active games must never enter the
    // idle-age scan, so the abandoned one is always reached — no fixed-order cap
    // could bury it behind the active majority.
    for (let i = 0; i < 3; i++) {
      await seedClassicGame(t, {
        players: [{ name: `Active${i}A` }, { name: `Active${i}B` }],
        roundStartedAt: Date.now(),
        createdAt: Date.now(),
      });
    }
    await seedClassicGame(t, {
      players: [
        { name: 'Ada', lastSeenAt: staleStamp() },
        { name: 'Bo', lastSeenAt: staleStamp() },
      ],
      roundStartedAt: staleStamp(),
      createdAt: staleStamp(),
    });

    const sweep = await t.mutation(
      internal.abandonment.sweepAbandonedGames,
      {}
    );
    // Only the idle game is scanned; the three active games are filtered out.
    expect(sweep).toEqual({ scheduled: 1, scanned: 1 });
  });

  it('an idle-but-present game does not pin the scan or block an abandoned one', async () => {
    const t = setupConvexTest();
    // An idle-round game where a human is still heartbeating (e.g. the per-turn
    // floor chain died): it sorts to the front of the oldest-idle scan but is
    // never abandoned. With no batch cap it cannot pin the scan — the truly
    // abandoned game behind it is still reached and scheduled.
    await seedClassicGame(t, {
      players: [
        { name: 'Present', lastSeenAt: Date.now() },
        { name: 'Gone', lastSeenAt: staleStamp() },
      ],
      roundStartedAt: staleStamp() - 60_000, // older idle, sorts first
      createdAt: staleStamp() - 60_000,
    });
    await seedClassicGame(t, {
      players: [
        { name: 'Ada', lastSeenAt: staleStamp() },
        { name: 'Bo', lastSeenAt: staleStamp() },
      ],
      roundStartedAt: staleStamp(),
      createdAt: staleStamp(),
    });

    const sweep = await t.mutation(
      internal.abandonment.sweepAbandonedGames,
      {}
    );
    expect(sweep).toEqual({ scheduled: 1, scanned: 2 });
  });

  it('does not fire while presence is mixed — one human never heartbeat', async () => {
    const t = setupConvexTest();
    // Rollout: Ada upgraded then went silent (stale by age); Bo is on the old
    // bundle and has never heartbeat, so Bo might still be present. The sweep
    // must hold off until the hard deadline; the per-turn floor owns Bo.
    await seedClassicGame(t, {
      players: [
        { name: 'Ada', lastSeenAt: staleStamp() },
        { name: 'Bo' }, // never heartbeat (lastSeenAt undefined)
      ],
      roundStartedAt: staleStamp(),
      createdAt: staleStamp(),
    });

    const sweep = await t.mutation(
      internal.abandonment.sweepAbandonedGames,
      {}
    );
    expect(sweep).toEqual({ scheduled: 0, scanned: 1 });
  });

  it('completes a long-idle game past the hard deadline even with no presence data', async () => {
    const t = setupConvexTest();
    // No human ever heartbeat (pre-presence game / fully lost rollout). Presence
    // can never confirm abandonment, but the room must not strand: past the hard
    // deadline the sweep completes it anyway.
    const { gameId } = await seedClassicGame(t, {
      players: [{ name: 'Ada' }, { name: 'Bo' }],
      roundStartedAt: deadlineStamp(),
      createdAt: deadlineStamp(),
    });

    const sweep = await t.mutation(
      internal.abandonment.sweepAbandonedGames,
      {}
    );
    expect(sweep).toEqual({ scheduled: 1, scanned: 1 });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const game = await t.run((ctx) => ctx.db.get(gameId));
    expect(game?.status).toBe('COMPLETED');
  });

  it('finisher bails when a human reconnects after the sweep scheduled it', async () => {
    const t = setupConvexTest();
    // The TOCTOU window: the sweep saw everyone stale, but before the worker
    // runs, Ada's tab reconnects and heartbeats. The worker re-derives presence
    // and must NOT complete the room over her.
    const { gameId, roomId, userIds } = await seedClassicGame(t, {
      players: [
        { name: 'Ada', lastSeenAt: staleStamp() },
        { name: 'Bo', lastSeenAt: staleStamp() },
      ],
      roundStartedAt: staleStamp(), // idle past threshold, under the hard deadline
      createdAt: staleStamp(),
    });

    // Ada returns.
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query('roomPlayers')
        .withIndex('by_room_user', (q) =>
          q.eq('roomId', roomId).eq('userId', userIds[0])
        )
        .first();
      await ctx.db.patch(row!._id, { lastSeenAt: Date.now() });
    });

    const result = await t.mutation(internal.abandonment.finishAbandonedGame, {
      gameId,
    });
    expect(result).toEqual({ completed: false, filled: 0 });
    const game = await t.run((ctx) => ctx.db.get(gameId));
    expect(game?.status).toBe('IN_PROGRESS');
  });

  it('heals a wedged round (all lines present but not advanced) instead of looping', async () => {
    const t = setupConvexTest();
    const { gameId, poemIds, matrix } = await seedClassicGame(t, {
      players: [
        { name: 'Ada', lastSeenAt: staleStamp() },
        { name: 'Bo', lastSeenAt: staleStamp() },
      ],
      roundStartedAt: staleStamp(),
      createdAt: staleStamp(),
      currentRound: 0,
    });
    // Force a wedged state: round 0 fully written, but currentRound never moved
    // off 0 (lines inserted directly, bypassing the lifecycle transition).
    await t.run(async (ctx) => {
      for (let p = 0; p < poemIds.length; p++) {
        await ctx.db.insert('lines', {
          poemId: poemIds[p],
          indexInPoem: 0,
          text: getFallbackLine(WORD_COUNTS[0]),
          wordCount: WORD_COUNTS[0],
          authorUserId: matrix[0][p],
          createdAt: Date.now(),
        });
      }
    });

    await t.mutation(internal.abandonment.finishAbandonedGame, { gameId });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const game = await t.run((ctx) => ctx.db.get(gameId));
    expect(game?.status).toBe('COMPLETED');
  });
});

describe('OpenRouter outage (oracle 5c)', () => {
  it('completes a full human+AI game through the safety nets with no network', async () => {
    const t = setupConvexTest();
    const { gameId, roomId } = await seedClassicGame(t, {
      players: [{ name: 'Ada' }, { name: 'Gemini', kind: 'AI' }],
      currentRound: 0,
    });

    // Kick the round-0 schedulers exactly as startGame does, then let the whole
    // runAfter chain drain. fetch is rejecting (outage) the entire time.
    await t.mutation(internal.ai.scheduleAiTurn, { roomId, gameId, round: 0 });
    await t.run((ctx) =>
      ctx.scheduler.runAfter(
        AUTO_GHOST_FILL_MS,
        internal.game.fillStaleHumanTurns,
        { roomId, gameId, round: 0 }
      )
    );
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const game = await t.run((ctx) => ctx.db.get(gameId));
    expect(game?.status).toBe('COMPLETED');
    const lines = await getAllLines(t, gameId);
    expect(lines).toHaveLength(WORD_COUNTS.length * 2);
    // Every line has the correct word count for its round (a valid fallback).
    for (const line of lines) {
      expect(countWords(line.text)).toBe(WORD_COUNTS[line.indexInPoem]);
    }
  });
});

describe('host-departed completion (child 4 / oracle 5d)', () => {
  it('a remaining participant acts, the floor finishes, host action never needed', async () => {
    const t = setupConvexTest();
    // Host (seat 0) walked away; the guest (seat 1) is still here.
    const { gameId, roomId, userIds, poemIds, matrix } = await seedClassicGame(
      t,
      {
        players: [
          { name: 'Host', lastSeenAt: staleStamp() },
          { name: 'Guest', clerkUserId: 'clerk_guest', lastSeenAt: Date.now() },
        ],
        currentRound: 0,
      }
    );
    const guestId = userIds[1];
    const asGuest = t.withIdentity({ subject: 'clerk_guest' });

    // The remaining participant writes their round-0 line — a real submission on
    // a host-departed game, landing before any floor.
    const guestPoem0 = matrix[0].indexOf(guestId);
    await asGuest.mutation(api.game.submitLine, {
      poemId: poemIds[guestPoem0],
      lineIndex: 0,
      text: getFallbackLine(WORD_COUNTS[0]),
    });

    // The floor (no host involvement) covers every remaining turn to reveal.
    await t.run((ctx) =>
      ctx.scheduler.runAfter(
        AUTO_GHOST_FILL_MS,
        internal.game.fillStaleHumanTurns,
        { roomId, gameId, round: 0 }
      )
    );
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const game = await t.run((ctx) => ctx.db.get(gameId));
    expect(game?.status).toBe('COMPLETED');

    // The guest's own round-0 line stayed genuinely theirs.
    const lines = await getAllLines(t, gameId);
    const guestLine0 = lines.find(
      (l) => l.indexInPoem === 0 && l.authorUserId === guestId
    );
    expect(guestLine0?.authorDisplayName).toBe('Guest');
    // The host never acted: every host-owned line is ghost-bylined.
    const hostLines = lines.filter((l) => l.authorUserId === userIds[0]);
    expect(hostLines.length).toBeGreaterThan(0);
    expect(hostLines.every((l) => l.authorDisplayName === 'Host (ghost)')).toBe(
      true
    );

    // The non-host participant can reach the reveal.
    const reveal = await asGuest.query(api.game.getRevealPhaseState, {
      roomCode: 'ABCD',
    });
    expect(reveal).not.toBeNull();
    expect(reveal?.poems).toHaveLength(2);
  });

  it('the abandonment cron finishes a fully host-departed room', async () => {
    const t = setupConvexTest();
    // Everyone — host included — is gone. No host-only action exists to block this.
    const { gameId } = await seedClassicGame(t, {
      players: [
        { name: 'Host', lastSeenAt: staleStamp() },
        { name: 'Guest', lastSeenAt: staleStamp() },
      ],
      roundStartedAt: staleStamp(),
      createdAt: staleStamp(),
    });

    await t.mutation(internal.abandonment.finishAbandonedGame, { gameId });
    const game = await t.run((ctx) => ctx.db.get(gameId));
    expect(game?.status).toBe('COMPLETED');
  });
});
