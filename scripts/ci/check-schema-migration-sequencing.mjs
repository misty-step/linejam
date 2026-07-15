#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const SCHEMA_FILE = 'convex/schema.ts';
const MIGRATIONS_FILE = 'convex/migrations.ts';
const FIELD_DEFINITION = /^[A-Za-z_$][\w$]*:\s*v\./;
const MIGRATION_EXPORT =
  /^export const [A-Za-z_$][\w$]*\s*=\s*(internalMutation|mutation|internalAction|action)\s*\(/;

function changedLines(diff, marker) {
  const header = marker.repeat(3);

  return diff
    .split('\n')
    .filter((line) => line.startsWith(marker) && !line.startsWith(header))
    .map((line) => line.slice(1).trim());
}

/**
 * Detect a schema field removal shipped beside a newly exported migration.
 * This deliberately conservative diff heuristic guards the exact failure
 * class described in docs/convex-migrations.md.
 */
export function detectSchemaContractionWithMigration({
  schemaDiff,
  migrationsDiff,
}) {
  const removedFields = changedLines(schemaDiff, '-').filter((line) =>
    FIELD_DEFINITION.test(line)
  );
  const addedMigrations = changedLines(migrationsDiff, '+').filter((line) =>
    MIGRATION_EXPORT.test(line)
  );

  return {
    violation: removedFields.length > 0 && addedMigrations.length > 0,
    removedFields,
    addedMigrations,
  };
}

function defaultExecute(command, args) {
  return execFileSync(command, args, { encoding: 'utf8' });
}

function diffAgainstBase(baseRef, file, execute) {
  try {
    return execute('git', ['diff', `${baseRef}...HEAD`, '--', file]);
  } catch (error) {
    const detail = error instanceof Error ? `: ${error.message}` : '';
    throw new Error(`Unable to inspect ${file} against ${baseRef}${detail}`);
  }
}

/** Compare the pull request head with its base, failing closed on Git errors. */
export function checkSchemaMigrationSequencing({
  baseRef,
  execute = defaultExecute,
}) {
  const schemaDiff = diffAgainstBase(baseRef, SCHEMA_FILE, execute);
  const migrationsDiff = diffAgainstBase(baseRef, MIGRATIONS_FILE, execute);

  return detectSchemaContractionWithMigration({
    schemaDiff,
    migrationsDiff,
  });
}

function printViolation(result) {
  const removedFields = result.removedFields
    .map((line) => `  - ${line}`)
    .join('\n');
  const addedMigrations = result.addedMigrations
    .map((line) => `  - ${line}`)
    .join('\n');

  console.error(`BLOCKED: schema contraction and migration share one change.

Convex validates existing data before the migration can run. Ship the
migration first, run and verify it in production, then remove the fields in a
later deploy.

Removed schema fields:
${removedFields}

Added migrations:
${addedMigrations}

See docs/convex-migrations.md.`);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const baseRef = process.argv[2];

  if (!baseRef) {
    console.error(
      'Usage: check-schema-migration-sequencing.mjs <base-ref>\n' +
        'Example: check-schema-migration-sequencing.mjs origin/master'
    );
    process.exit(2);
  }

  const result = checkSchemaMigrationSequencing({ baseRef });
  if (result.violation) {
    printViolation(result);
    process.exit(1);
  }

  console.log('OK: no schema contraction ships with a new migration.');
}
