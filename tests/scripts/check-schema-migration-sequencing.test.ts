/** @vitest-environment node */
import { describe, expect, it, vi } from 'vitest';
import {
  checkSchemaMigrationSequencing,
  detectSchemaContractionWithMigration,
} from '@/scripts/ci/check-schema-migration-sequencing.mjs';

const incidentSchemaDiff = `diff --git a/convex/schema.ts b/convex/schema.ts
--- a/convex/schema.ts
+++ b/convex/schema.ts
@@ -30,8 +30,6 @@
-    mode: v.optional(v.string()),
-    selectedMode: v.optional(v.string()),
     currentRound: v.number(),`;

const incidentMigrationDiff = `diff --git a/convex/migrations.ts b/convex/migrations.ts
--- a/convex/migrations.ts
+++ b/convex/migrations.ts
@@ -1,3 +1,8 @@
+export const dropLegacyModeColumns = internalMutation({
+  args: {},`;

describe('detectSchemaContractionWithMigration', () => {
  it('blocks the 2026-07-04 schema contraction and migration shape', () => {
    expect(
      detectSchemaContractionWithMigration({
        schemaDiff: incidentSchemaDiff,
        migrationsDiff: incidentMigrationDiff,
      })
    ).toEqual({
      violation: true,
      removedFields: ['mode', 'selectedMode'],
      addedMigrations: [
        'export const dropLegacyModeColumns = internalMutation(',
      ],
    });
  });

  it('blocks a migration export that Prettier wraps after the assignment', () => {
    const wrappedMigrationDiff = `@@ -1,3 +1,8 @@
+export const dropLegacyModeColumnsWithAnIntentionallyLongName =
+  internalMutation({
+    args: {},`;

    expect(
      detectSchemaContractionWithMigration({
        schemaDiff: incidentSchemaDiff,
        migrationsDiff: wrappedMigrationDiff,
      })
    ).toMatchObject({
      violation: true,
      addedMigrations: [
        'export const dropLegacyModeColumnsWithAnIntentionallyLongName = internalMutation(',
      ],
    });
  });

  it.each([
    ['reusable validator', '-    legacyMode: legacyModeValidator,'],
    [
      'multiline validator',
      '-    legacyMode:\n-      v.optional(v.union(v.literal("solo"), v.literal("group"))),',
    ],
  ])('blocks a removed %s field', (_name, schemaDiff) => {
    expect(
      detectSchemaContractionWithMigration({
        schemaDiff,
        migrationsDiff: incidentMigrationDiff,
      })
    ).toMatchObject({
      violation: true,
      removedFields: ['legacyMode'],
    });
  });

  it('allows additive schema and migration changes', () => {
    const schemaDiff = incidentSchemaDiff.replaceAll('-', '+');

    expect(
      detectSchemaContractionWithMigration({
        schemaDiff,
        migrationsDiff: incidentMigrationDiff,
      }).violation
    ).toBe(false);
  });

  it('allows a field validator to expand beside a migration', () => {
    const expandedStatusDiff = `@@ -1,3 +1,3 @@
-    status: v.union(v.literal('IN_PROGRESS'), v.literal('COMPLETED')),
+    status: v.union(
+      v.literal('IN_PROGRESS'),
+      v.literal('COMPLETED'),
+      v.literal('ABANDONED')
+    ),`;

    expect(
      detectSchemaContractionWithMigration({
        schemaDiff: expandedStatusDiff,
        migrationsDiff: incidentMigrationDiff,
      })
    ).toEqual({
      violation: false,
      removedFields: [],
      addedMigrations: [
        'export const dropLegacyModeColumns = internalMutation(',
      ],
    });
  });

  it('matches duplicate field names by occurrence and blocks a later narrowing', () => {
    const mixedStatusDiff = `@@ -1,6 +1,9 @@
-    status: v.union(v.literal('IN_PROGRESS'), v.literal('COMPLETED')),
+    status: v.union(
+      v.literal('IN_PROGRESS'),
+      v.literal('COMPLETED'),
+      v.literal('ABANDONED')
+    ),
-    status: v.union(v.literal('DRAFT'), v.literal('PUBLISHED')),
+    status: v.union(v.literal('DRAFT')),`;

    expect(
      detectSchemaContractionWithMigration({
        schemaDiff: mixedStatusDiff,
        migrationsDiff: incidentMigrationDiff,
      })
    ).toMatchObject({
      violation: true,
      removedFields: ['status'],
    });
  });

  it('blocks an optional field narrowed to required beside a migration', () => {
    const narrowedFieldDiff = `@@ -1,3 +1,3 @@
-    legacyMode: v.optional(v.string()),
+    legacyMode: v.string(),`;

    expect(
      detectSchemaContractionWithMigration({
        schemaDiff: narrowedFieldDiff,
        migrationsDiff: incidentMigrationDiff,
      })
    ).toMatchObject({
      violation: true,
      removedFields: ['legacyMode'],
    });
  });

  it('blocks a literal-union contraction beside a migration', () => {
    const narrowedUnionDiff = `@@ -1,3 +1,3 @@
-    status: v.union(v.literal('OPEN'), v.literal('CLOSED')),
+    status: v.union(v.literal('OPEN')),`;

    expect(
      detectSchemaContractionWithMigration({
        schemaDiff: narrowedUnionDiff,
        migrationsDiff: incidentMigrationDiff,
      })
    ).toMatchObject({
      violation: true,
      removedFields: ['status'],
    });
  });

  it('allows a contraction after its migration has already shipped', () => {
    expect(
      detectSchemaContractionWithMigration({
        schemaDiff: incidentSchemaDiff,
        migrationsDiff: '',
      }).violation
    ).toBe(false);
  });

  it('ignores removed comments and syntax', () => {
    expect(
      detectSchemaContractionWithMigration({
        schemaDiff: '-    // legacy field\n-  }),',
        migrationsDiff: incidentMigrationDiff,
      }).violation
    ).toBe(false);
  });
});

describe('checkSchemaMigrationSequencing', () => {
  it('diffs both authoritative files against the PR merge base', () => {
    const execute = vi
      .fn<(command: string, args: string[]) => string>()
      .mockReturnValueOnce(incidentSchemaDiff)
      .mockReturnValueOnce(incidentMigrationDiff);

    expect(
      checkSchemaMigrationSequencing({ baseRef: 'origin/master', execute })
        .violation
    ).toBe(true);
    expect(execute).toHaveBeenNthCalledWith(1, 'git', [
      'diff',
      'origin/master...HEAD',
      '--',
      'convex/schema.ts',
    ]);
    expect(execute).toHaveBeenNthCalledWith(2, 'git', [
      'diff',
      'origin/master...HEAD',
      '--',
      'convex/migrations.ts',
    ]);
  });

  it('fails closed when the comparison cannot be evaluated', () => {
    const execute = vi.fn(() => {
      throw new Error('missing merge base');
    });

    expect(() =>
      checkSchemaMigrationSequencing({
        baseRef: 'origin/master',
        execute,
      })
    ).toThrow(/Unable to inspect convex\/schema\.ts.*missing merge base/);
  });
});
