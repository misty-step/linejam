/**
 * TEMPORARY PLACEHOLDER - FOR PHASE 2 MIGRATION
 *
 * This file demonstrates the planned convex-test API.
 * convex-test is installed (v0.0.30) but requires additional setup/config.
 *
 * BENEFITS OF CONVEX-TEST (vs manual mocking):
 * - 100x faster execution (JS mock vs Docker)
 * - Simpler API: just insert data, call mutation, assert
 * - More reliable: uses real Convex runtime
 * - Better DX: no mock setup boilerplate
 *
 * EXAMPLE USAGE (from docs):
 *
 * ```typescript
 * import { convexTest } from 'convex-test';
 * import { api } from '../convex/_generated/api';
 * import schema from '../convex/schema';
 *
 * const t = convexTest(schema);
 *
 * // Insert test data
 * const userId = await t.run(async (ctx) => {
 *   return await ctx.db.insert('users', { name: 'Alice' });
 * });
 *
 * // Call mutation
 * await t.mutation(api.game.startGame, { roomId });
 *
 * // Assert
 * const room = await t.run(async (ctx) => ctx.db.get(roomId));
 * expect(room?.status).toBe('IN_PROGRESS');
 * ```
 *
 * TODO: Phase 2 will configure convex-test properly and migrate existing tests.
 * DELETE this file after migration complete.
 */

import { describe, it, expect } from 'vitest';
import { convexTest } from 'convex-test';

describe('convex-test placeholder', () => {
  it('is installed and ready for Phase 2', () => {
    expect(convexTest).toBeDefined();
    expect(typeof convexTest).toBe('function');
  });
});
