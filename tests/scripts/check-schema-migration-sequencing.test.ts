/** @vitest-environment node */
import { execFileSync } from 'node:child_process';
import { describe, expect, it, vi } from 'vitest';
import {
  checkSequencing,
  detectSchemaContractionWithMigration,
} from '@/scripts/ci/check-schema-migration-sequencing.mjs';

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
    const schemaDiff = execFileSync(
      'git',
      ['show', '684de32', '--', 'convex/schema.ts'],
      { encoding: 'utf8' }
    );
    const migrationsDiff = execFileSync(
      'git',
      ['show', '684de32', '--', 'convex/migrations.ts'],
      { encoding: 'utf8' }
    );

    const result = detectSchemaContractionWithMigration({
      schemaDiff,
      migrationsDiff,
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
