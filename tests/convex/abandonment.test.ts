import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, internal } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { WORD_COUNTS } from '../../convex/lib/gameRules';
import { RETENTION_DURATIONS_MS } from '../../convex/lib/retentionPolicy';
import { setupConvexTest } from '../helpers/convexTest';
import { asUser, seedClerkUser } from '../helpers/convexSeed';

type T = ReturnType<typeof setupConvexTest>;

const ABANDON_AFTER_MS = 10 * 60_000;

async function seedNativeMatch(
  t: T,
  options: { fresh?: boolean; withLine?: boolean; code?: string } = {}
): Promise<{
  roomId: Id<'rooms'>;
  gameId: Id<'games'>;
  matchId: Id<'matches'>;
  poemIds: Id<'poems'>[];
}> {
  const now = Date.now();
  const lastSeenAt = options.fresh ? now : now - ABANDON_AFTER_MS - 1;
  const startedAt = now - ABANDON_AFTER_MS - 1;
  return t.run(async (ctx) => {
    const userIds = await Promise.all(
      ['Host', 'Guest'].map((displayName) =>
        ctx.db.insert('users', {
          displayName,
          kind: 'human',
          createdAt: now,
        })
      )
    );
    const playerIds = await Promise.all(
      userIds.map((userId) =>
        ctx.db.insert('players', {
          identityKey: `linejam:user:${userId}`,
          kind: 'authenticated',
          createdAt: now,
        })
      )
    );
    const roomId = await ctx.db.insert('rooms', {
      code: options.code ?? 'ABCD',
      hostUserId: userIds[0],
      hostPlayerId: playerIds[0],
      status: 'IN_PROGRESS',
      createdAt: now,
      retentionState: 'active',
    });
    await Promise.all(
      userIds.map((userId, seatIndex) =>
        Promise.all([
          ctx.db.insert('roomMembers', {
            roomId,
            playerId: playerIds[seatIndex],
            displayName: seatIndex === 0 ? 'Host' : 'Guest',
            seatIndex,
            joinedAt: now,
            eligibleFromCycle: 0,
            lastSeenAt,
          }),
          ctx.db.insert('roomPlayers', {
            roomId,
            userId,
            playerId: playerIds[seatIndex],
            displayName: seatIndex === 0 ? 'Host' : 'Guest',
            joinedAt: now,
          }),
        ])
      )
    );
    const assignmentMatrix = Array.from(
      { length: WORD_COUNTS.length },
      (_, r) =>
        userIds.map((_, poemIndex) => userIds[(poemIndex + r) % userIds.length])
    );
    const matchId = await ctx.db.insert('matches', {
      roomId,
      cycle: 1,
      status: 'active',
      startedAt,
      hardDeadline: false,
    });
    await Promise.all(
      playerIds.map((playerId, seatIndex) =>
        ctx.db.insert('matchParticipants', {
          matchId,
          playerId,
          seatIndex,
        })
      )
    );
    const gameId = await ctx.db.insert('games', {
      roomId,
      matchId,
      status: 'IN_PROGRESS',
      cycle: 1,
      currentRound: 0,
      roundStartedAt: startedAt,
      assignmentMatrix,
      createdAt: startedAt,
      retentionState: 'active',
    });
    await ctx.db.patch(roomId, { currentGameId: gameId });
    const poemIds = await Promise.all(
      userIds.map((_, indexInRoom) =>
        ctx.db.insert('poems', {
          roomId,
          gameId,
          indexInRoom,
          createdAt: now,
          retentionState: 'active',
        })
      )
    );
    if (options.withLine) {
      await ctx.db.insert('lines', {
        poemId: poemIds[0],
        indexInPoem: 0,
        text: 'still',
        wordCount: 1,
        authorUserId: userIds[0],
        authorDisplayName: 'Host',
        createdAt: now,
      });
    }
    return { roomId, gameId, matchId, poemIds };
  });
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('abandonment', () => {
  it('closes an unattended Parlor match as ABANDONED without inserting or revealing lines', async () => {
    const t = setupConvexTest();
    const { roomId, gameId, matchId, poemIds } = await seedNativeMatch(t, {
      withLine: true,
    });

    const result = await t.mutation(internal.abandonment.sweepAbandonedGames, {
      limit: 1,
    });
    expect(result).toMatchObject({
      abandoned: 1,
      scanned: 1,
      hasMore: false,
      continueCursor: null,
    });

    const state = await t.run(async (ctx) => ({
      game: await ctx.db.get(gameId),
      match: await ctx.db.get(matchId),
      room: await ctx.db.get(roomId),
      poems: await Promise.all(poemIds.map((poemId) => ctx.db.get(poemId))),
      lines: await ctx.db.query('lines').collect(),
      profiles: await ctx.db
        .query('roomPlayers')
        .withIndex('by_room', (q) => q.eq('roomId', roomId))
        .collect(),
      members: await ctx.db
        .query('roomMembers')
        .withIndex('by_room', (q) => q.eq('roomId', roomId))
        .collect(),
    }));

    expect(state.game?.status).toBe('ABANDONED');
    expect(state.game).not.toHaveProperty('completionKind');
    expect(state.game?.retentionEligibleAt).toBe(
      state.game!.completedAt! + RETENTION_DURATIONS_MS.abandoned
    );
    expect(state.match?.status).toBe('abandoned');
    expect(state.room?.status).toBe('COMPLETED');
    expect(state.room?.currentGameId).toBeUndefined();
    expect(state.room?.closedAt).toBe(
      state.match && 'abandonedAt' in state.match
        ? state.match.abandonedAt
        : undefined
    );
    expect(state.profiles).toHaveLength(2);
    expect(state.members.every((member) => member.closedAt !== undefined)).toBe(
      true
    );
    expect(state.lines).toHaveLength(1);
    expect(state.lines[0].text).toBe('still');
    expect(state.poems.every((poem) => poem?.completedAt === undefined)).toBe(
      true
    );
    expect(
      state.poems.every((poem) => poem?.assignedReaderId === undefined)
    ).toBe(true);
  });

  it('does nothing while any frozen participant has a fresh heartbeat', async () => {
    const t = setupConvexTest();
    const { gameId, matchId } = await seedNativeMatch(t, { fresh: true });
    expect(
      await t.mutation(internal.abandonment.sweepAbandonedGames, { limit: 1 })
    ).toMatchObject({ abandoned: 0, scanned: 1, hasMore: false });
    const [game, match] = await t.run(async (ctx) => [
      await ctx.db.get(gameId),
      await ctx.db.get(matchId),
    ]);
    expect(game?.status).toBe('IN_PROGRESS');
    expect(match?.status).toBe('active');
  });

  it('treats accepted commands as presence without requiring a browser heartbeat', async () => {
    const t = setupConvexTest();
    const began = Date.now();
    await seedClerkUser(t, 'command-host');
    await seedClerkUser(t, 'command-guest');
    const host = asUser(t, 'command-host');
    const guest = asUser(t, 'command-guest');
    const { code } = await host.mutation(api.rooms.createRoom, {
      displayName: 'Host',
    });
    await guest.mutation(api.rooms.joinRoom, { code, displayName: 'Guest' });
    vi.setSystemTime(began + ABANDON_AFTER_MS + 1);
    await host.mutation(api.game.startGame, { code });
    expect(
      await t.mutation(internal.abandonment.sweepAbandonedGames, {})
    ).toMatchObject({
      abandoned: 0,
    });
    for (const [round, text] of [
      'amber',
      'quiet river',
      'moonlit paths wander',
    ].entries()) {
      vi.setSystemTime(began + ABANDON_AFTER_MS + 1 + (round + 1) * 5 * 60_000);
      for (const player of [host, guest]) {
        const assignment = await player.query(api.game.getCurrentAssignment, {
          roomCode: code,
        });
        if (!assignment) throw new Error('Missing assignment');
        await player.mutation(api.game.submitLine, {
          poemId: assignment.poemId,
          lineIndex: assignment.lineIndex,
          text,
        });
      }
      expect(
        await t.mutation(internal.abandonment.sweepAbandonedGames, {})
      ).toMatchObject({
        abandoned: 0,
      });
    }
    vi.setSystemTime(Date.now() + ABANDON_AFTER_MS + 1);
    expect(
      await t.mutation(internal.abandonment.sweepAbandonedGames, {})
    ).toMatchObject({
      abandoned: 1,
    });
  });

  it('continues every sweep page even when the current page abandons nothing', async () => {
    const t = setupConvexTest();
    const stale = await seedNativeMatch(t, { code: 'STLE' });
    const fresh = await seedNativeMatch(t, { fresh: true, code: 'FRSH' });

    const first = await t.mutation(internal.abandonment.sweepAbandonedGames, {
      limit: 1,
    });
    expect(first.hasMore).toBe(true);
    expect(first.continueCursor).toEqual(expect.any(String));

    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const [staleGame, freshGame, freshMatch] = await t.run(async (ctx) => [
      await ctx.db.get(stale.gameId),
      await ctx.db.get(fresh.gameId),
      await ctx.db.get(fresh.matchId),
    ]);
    expect(staleGame?.status).toBe('ABANDONED');
    expect(freshGame?.status).toBe('IN_PROGRESS');
    expect(freshMatch?.status).toBe('active');
    expect(await t.run((ctx) => ctx.db.query('lines').collect())).toHaveLength(
      0
    );
  });
});
