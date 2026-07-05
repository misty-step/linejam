/** @vitest-environment node */
import { describe, expect, it, vi } from 'vitest';
import {
  checkSequencing,
  detectSchemaContractionWithMigration,
  formatViolationMessage,
} from '@/scripts/ci/check-schema-migration-sequencing.mjs';

// Frozen copies of `git show 684de32 -- convex/schema.ts` and
// `-- convex/migrations.ts` (the actual 2026-07-04 outage commit). Embedded
// as literal fixtures rather than shelled out to `git show` at test time:
// this suite also runs inside the Dagger unit-test container, which has no
// `.git` directory (a hermetic source-tree snapshot, by design) -- shelling
// out there fails with "fatal: not a git repository" regardless of host.
const PR_298_SCHEMA_DIFF = `diff --git a/convex/schema.ts b/convex/schema.ts
index bae9377..c759439 100644
--- a/convex/schema.ts
+++ b/convex/schema.ts
@@ -33,9 +33,6 @@ export default defineSchema({
     completedAt: v.optional(v.number()),
     currentGameId: v.optional(v.id('games')),
     currentCycle: v.optional(v.number()),
-    /** Legacy, unused: the game is single-mode. Retained (optional string) so
-     *  existing rows that carry a mode value stay valid without a migration. */
-    selectedMode: v.optional(v.string()),
   })
     .index('by_code', ['code'])
     .index('by_host', ['hostUserId'])
@@ -59,9 +56,6 @@ export default defineSchema({
     status: v.union(v.literal('IN_PROGRESS'), v.literal('COMPLETED')),
     /** Game session count for this room. First game = 1. */
     cycle: v.number(),
-    /** Legacy, unused: the game is single-mode. Retained (optional string) so
-     *  existing rows that carry a mode value stay valid without a migration. */
-    mode: v.optional(v.string()),
     /** Round index within current game. Shape comes from convex/lib/gameRules.ts. */
     currentRound: v.number(),
     /** When the current round opened. Drives the soft clock and ghostwriter overtime gate. */
`;

const PR_298_MIGRATIONS_DIFF = `diff --git a/convex/migrations.ts b/convex/migrations.ts
index e21891d..d539e09 100644
--- a/convex/migrations.ts
+++ b/convex/migrations.ts
@@ -1,8 +1,45 @@
 import { ConvexError, v } from 'convex/values';
-import { mutation } from './_generated/server';
+import { internalMutation, mutation } from './_generated/server';
 import { verifyGuestToken } from './lib/guestToken';
 import { ensureUserHelper } from './users';

+const hasOwn = (value: object, key: string) =>
+  Object.prototype.hasOwnProperty.call(value, key);
+
+const removeGameModePatch = { mode: undefined } as never;
+const removeSelectedModePatch = { selectedMode: undefined } as never;
+
+export const dropLegacyModeColumns = internalMutation({
+  args: {},
+  handler: async (ctx) => {
+    const [games, rooms] = await Promise.all([
+      ctx.db.query('games').collect(),
+      ctx.db.query('rooms').collect(),
+    ]);
+
+    const gamesWithMode = games.filter((game) => hasOwn(game, 'mode'));
+    const roomsWithSelectedMode = rooms.filter((room) =>
+      hasOwn(room, 'selectedMode')
+    );
+
+    await Promise.all([
+      ...gamesWithMode.map((game) =>
+        ctx.db.patch(game._id, removeGameModePatch)
+      ),
+      ...roomsWithSelectedMode.map((room) =>
+        ctx.db.patch(room._id, removeSelectedModePatch)
+      ),
+    ]);
+
+    return {
+      gamesScanned: games.length,
+      gamesCleared: gamesWithMode.length,
+      roomsScanned: rooms.length,
+      roomsCleared: roomsWithSelectedMode.length,
+    };
+  },
+});
+
 export const migrateGuestToUser = mutation({
   args: {
     guestToken: v.string(),
`;

describe('detectSchemaContractionWithMigration', () => {
  it('flags a real removed field alongside a real new migration export', () => {
    const schemaDiff = [
      '--- a/convex/schema.ts',
      '+++ b/convex/schema.ts',
      '@@ -33,9 +33,6 @@',
      '     completedAt: v.optional(v.number()),',
      '-    mode: v.optional(v.string()),',
      '     currentRound: v.number(),',
    ].join('\n');
    const migrationsDiff = [
      '--- a/convex/migrations.ts',
      '+++ b/convex/migrations.ts',
      '@@ -1,3 +1,10 @@',
      '+export const dropLegacyModeColumns = internalMutation({',
      '+  args: {},',
    ].join('\n');

    const result = detectSchemaContractionWithMigration({
      schemaDiff,
      migrationsDiff,
    });

    expect(result.violation).toBe(true);
    expect(result.removedFields).toContain('mode: v.optional(v.string()),');
    expect(result.addedMigrations).toContain(
      'export const dropLegacyModeColumns = internalMutation({'
    );
  });

  it('reproduces the actual 2026-07-04 PR #298 diff as a violation', () => {
    // Regression fixture: the exact diffs from commit 684de32 ("drop legacy
    // mode columns"), which shipped the schema contraction and its migration
    // in the same change and wedged production. If this stops failing, the
    // check has regressed.
    const result = detectSchemaContractionWithMigration({
      schemaDiff: PR_298_SCHEMA_DIFF,
      migrationsDiff: PR_298_MIGRATIONS_DIFF,
    });

    expect(result.violation).toBe(true);
    expect(
      result.addedMigrations.some((line) =>
        line.includes('dropLegacyModeColumns')
      )
    ).toBe(true);
  });

  it('does not flag a schema-only change with no new migration', () => {
    const schemaDiff = [
      '--- a/convex/schema.ts',
      '+++ b/convex/schema.ts',
      '-    unused: v.optional(v.string()),',
    ].join('\n');

    const result = detectSchemaContractionWithMigration({
      schemaDiff,
      migrationsDiff: '',
    });

    expect(result.violation).toBe(false);
  });

  it('does not flag a migration-only change with no schema removal', () => {
    const migrationsDiff = [
      '--- a/convex/migrations.ts',
      '+++ b/convex/migrations.ts',
      '+export const backfillSomething = internalMutation({',
    ].join('\n');

    const result = detectSchemaContractionWithMigration({
      schemaDiff: '',
      migrationsDiff,
    });

    expect(result.violation).toBe(false);
  });

  it('ignores non-field removed lines in schema.ts (comments, formatting)', () => {
    const schemaDiff = [
      '--- a/convex/schema.ts',
      '+++ b/convex/schema.ts',
      '-  /** stale comment */',
      '-  })',
    ].join('\n');
    const migrationsDiff = [
      '+export const backfillSomething = internalMutation({',
    ].join('\n');

    const result = detectSchemaContractionWithMigration({
      schemaDiff,
      migrationsDiff,
    });

    expect(result.violation).toBe(false);
  });
});

describe('checkSequencing', () => {
  it('runs git diff against the given base ref for both files', () => {
    const exec = vi.fn().mockReturnValue('');
    const result = checkSequencing({ baseRef: 'origin/master', exec });

    expect(result.violation).toBe(false);
    expect(exec).toHaveBeenCalledWith('git', [
      'diff',
      'origin/master...HEAD',
      '--',
      'convex/schema.ts',
    ]);
    expect(exec).toHaveBeenCalledWith('git', [
      'diff',
      'origin/master...HEAD',
      '--',
      'convex/migrations.ts',
    ]);
  });

  it('treats a thrown diff (e.g. file absent on one side) as an empty diff rather than crashing', () => {
    const exec = vi.fn().mockImplementation(() => {
      throw new Error('git diff failed');
    });

    expect(() =>
      checkSequencing({ baseRef: 'origin/master', exec })
    ).not.toThrow();
    expect(checkSequencing({ baseRef: 'origin/master', exec }).violation).toBe(
      false
    );
  });
});

describe('formatViolationMessage', () => {
  it('names the exact removed fields and added migrations', () => {
    const message = formatViolationMessage({
      removedFields: ['mode: v.optional(v.string()),'],
      addedMigrations: [
        'export const dropLegacyModeColumns = internalMutation({',
      ],
    });

    expect(message).toContain('BLOCKED');
    expect(message).toContain('mode: v.optional(v.string()),');
    expect(message).toContain('dropLegacyModeColumns');
    expect(message).toContain('docs/convex-migrations.md');
  });
});
