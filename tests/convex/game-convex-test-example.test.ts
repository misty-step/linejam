/**
 * convex-test reference example.
 *
 * convex-test runs the real Convex query engine + scheduler in-memory — no mock
 * DB. It was long deferred here over an `import.meta.glob` error, but that was
 * self-inflicted: calling `convexTest(schema)` with no modules makes the library
 * run its glob from inside node_modules, which Vite never transforms. Passing the
 * glob from a project file fixes it. See `tests/helpers/convexTest.ts`.
 *
 * Prefer this harness over the mock DB (`tests/helpers/mockConvexDb.ts`) whenever
 * a test needs real read-your-writes semantics or scheduled functions — e.g. the
 * multi-round completion chain in `tests/convex/abandonment.test.ts`.
 */

import { describe, it, expect } from 'vitest';
import { setupConvexTest } from '../helpers/convexTest';

describe('convex-test', () => {
  it('runs against a real in-memory backend', async () => {
    const t = setupConvexTest();

    const room = await t.run(async (ctx) => {
      const hostUserId = await ctx.db.insert('users', {
        displayName: 'Host',
        kind: 'human',
        createdAt: 0,
      });
      const roomId = await ctx.db.insert('rooms', {
        code: 'WXYZ',
        hostUserId,
        status: 'LOBBY',
        createdAt: 0,
      });
      return ctx.db.get(roomId);
    });

    expect(room?.code).toBe('WXYZ');
    expect(room?.status).toBe('LOBBY');
  });
});
