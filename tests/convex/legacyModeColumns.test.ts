import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import { internal } from '../../convex/_generated/api';
import { setupConvexTestWithSchema } from '../helpers/convexTest';
import schema from '../../convex/schema';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

function readSourceFiles(dir: string): Array<[path: string, source: string]> {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = join(dir, entry.name);
    if (entry.isDirectory()) return readSourceFiles(absolutePath);
    if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx')) return [];
    return [[absolutePath, readFileSync(absolutePath, 'utf8')]];
  });
}

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

  it('keeps the final schema and tests free of the retired mode columns', async () => {
    const schemaSource = readFileSync(
      join(repoRoot, 'convex/schema.ts'),
      'utf8'
    );
    const convexTestSources = readSourceFiles(join(repoRoot, 'tests/convex'));

    expect(JSON.stringify(schema)).not.toContain('selectedMode');
    expect(JSON.stringify(schema)).not.toContain('"mode"');
    expect(schemaSource).not.toContain('selectedMode');
    expect(schemaSource).not.toMatch(/\bmode:\s*v\.optional/);

    const staleSeeders = convexTestSources
      .filter(([path]) => !path.endsWith('legacyModeColumns.test.ts'))
      .filter(([, source]) => /\bmode:\s*['"]classic['"]/.test(source));

    expect(staleSeeders).toEqual([]);
  });
});
