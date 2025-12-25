/**
 * CONVEX-TEST MIGRATION NOTES
 *
 * convex-test is installed (v0.0.30) but requires Vite environment configuration.
 *
 * BLOCKER: import.meta.glob
 * convex-test internally uses `import.meta.glob` to discover Convex modules.
 * This is a Vite-specific feature not available in Node test environment.
 * Error: "TypeError: (intermediate value).glob is not a function"
 *
 * SOLUTIONS (pick one):
 * 1. Configure Vitest to use Vite environment for convex tests
 * 2. Pass modules explicitly via second argument to convexTest()
 * 3. Wait for convex-test to support non-Vite environments
 *
 * BENEFITS (when working):
 * - No mock setup needed - test real Convex behavior
 * - Simpler API: insert data, call mutation, assert
 * - ~1000 lines of mock code deleted
 *
 * EXAMPLE (from docs):
 * ```typescript
 * const t = convexTest(schema);
 * const userId = await t.run(ctx => ctx.db.insert('users', { name: 'Alice' }));
 * await t.mutation(api.game.startGame, { roomId });
 * const room = await t.run(ctx => ctx.db.get(roomId));
 * expect(room?.status).toBe('IN_PROGRESS');
 * ```
 *
 * CURRENT STATE: Manual mocking works, migration deferred until Vite config sorted.
 * See: https://docs.convex.dev/testing/convex-test
 */

import { describe, it, expect } from 'vitest';
import { convexTest } from 'convex-test';

describe('convex-test', () => {
  it('is installed', () => {
    expect(convexTest).toBeDefined();
    expect(typeof convexTest).toBe('function');
  });
});
