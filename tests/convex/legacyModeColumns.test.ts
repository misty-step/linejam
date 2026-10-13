import { describe, expect, it } from 'vitest';
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import { internal } from '../../convex/_generated/api';
import { setupConvexTestWithSchema } from '../helpers/convexTest';
const legacyModeSchema = defineSchema({
  users: defineTable({
    displayName: v.string(),
    createdAt: v.number(),
    kind: v.optional(v.union(v.literal('human'), v.literal('AI'))),
  }),

  rooms: defineTable({
    code: v.string(),
    hostUserId: v.id('users'),
    status: v.union(
      v.literal('LOBBY'),
      v.literal('IN_PROGRESS'),
      v.literal('COMPLETED')
    ),
    createdAt: v.number(),
    selectedMode: v.optional(v.string()),
  }),

  games: defineTable({
    roomId: v.id('rooms'),
    status: v.union(v.literal('IN_PROGRESS'), v.literal('COMPLETED')),
    cycle: v.number(),
    mode: v.optional(v.string()),
    currentRound: v.number(),
    assignmentMatrix: v.array(v.array(v.id('users'))),
    createdAt: v.number(),
  }),
});

describe('legacy mode column migration', () => {
  it('clears existing game.mode and room.selectedMode values before the schema drop', async () => {
    const t = setupConvexTestWithSchema(legacyModeSchema);

    const { gameId, roomId } = await t.run(async (ctx) => {
      const hostUserId = await ctx.db.insert('users', {
        displayName: 'Host',
        kind: 'human',
        createdAt: 0,
      });
      const roomId = await ctx.db.insert('rooms', {
        code: 'DROP',
        hostUserId,
        status: 'IN_PROGRESS',
        selectedMode: 'classic',
        createdAt: 0,
      });
      const gameId = await ctx.db.insert('games', {
        roomId,
        status: 'IN_PROGRESS',
        cycle: 1,
        mode: 'classic',
        currentRound: 0,
        assignmentMatrix: [[hostUserId]],
        createdAt: 0,
      });

      return { gameId, roomId };
    });

    const result = await t.mutation(
      internal.migrations.dropLegacyModeColumns,
      {}
    );

    expect(result).toEqual({
      gamesScanned: 1,
      gamesCleared: 1,
      roomsScanned: 1,
      roomsCleared: 1,
    });

    const { game, room } = await t.run(async (ctx) => ({
      game: await ctx.db.get(gameId),
      room: await ctx.db.get(roomId),
    }));

    expect(game).not.toHaveProperty('mode');
    expect(room).not.toHaveProperty('selectedMode');
  });
});
