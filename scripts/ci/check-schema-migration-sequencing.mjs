#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const SCHEMA_FILE = 'convex/schema.ts';
const MIGRATIONS_FILE = 'convex/migrations.ts';

// A field definition line inside defineSchema(...), e.g.
//   mode: v.optional(v.string()),
const FIELD_LINE_PATTERN = /^[A-Za-z_$][\w$]*:\s*v\./;

// A newly exported Convex function in migrations.ts, e.g.
//   export const dropLegacyModeColumns = internalMutation({
const MIGRATION_EXPORT_PATTERN =
  /^export const \w+ = (internalMutation|mutation|internalAction|action)\(/;

/**
 * Pull the `+`/`-` content lines out of a unified diff, stripping the
 * leading marker and ignoring the `---`/`+++` file headers.
 *
 * @param {string} diffText
 * @param {'+' | '-'} marker
 * @returns {string[]}
 */
function changedLines(diffText, marker) {
  const headerMarker = marker === '+' ? '+++' : '---';
  return diffText
    .split('\n')
    .filter((line) => line.startsWith(marker) && !line.startsWith(headerMarker))
    .map((line) => line.slice(1).trim());
}

/**
 * Detect the exact 2026-07-04 failure class: a schema contraction (removed
 * field) and its migration both landing in the same change. Expand-migrate-
 * contract requires the migration to have already run in production before
 * the field can be removed — shipping both together wedges every deploy
 * because Convex validates schema against live data at push time, and the
 * migration itself cannot reach prod because it rides the same blocked
 * deploy (see docs/convex-migrations.md).
 *
 * @param {{ schemaDiff: string, migrationsDiff: string }} params
 */
export function detectSchemaContractionWithMigration({
  schemaDiff,
  migrationsDiff,
}) {
  const removedFields = changedLines(schemaDiff, '-').filter((line) =>
    FIELD_LINE_PATTERN.test(line)
  );
  const addedMigrations = changedLines(migrationsDiff, '+').filter((line) =>
    MIGRATION_EXPORT_PATTERN.test(line)
  );

  return {
    violation: removedFields.length > 0 && addedMigrations.length > 0,
    removedFields,
    addedMigrations,
  };
}

/**
 * @param {string} baseRef
 * @param {string} file
 * @param {(command: string, args: string[]) => string} exec
 */
function diffAgainstBase(baseRef, file, exec) {
  try {
    return exec('git', ['diff', `${baseRef}...HEAD`, '--', file]);
  } catch {
    // File may not exist on one side of the diff (new/deleted file); an
    // empty diff is the correct, safe result -- not a check failure.
    return '';
  }
}

function defaultExec(command, args) {
  return execFileSync(command, args, { encoding: 'utf8' });
}

/**
 * @param {{ baseRef: string, exec?: (command: string, args: string[]) => string }} params
 */
export function checkSequencing({ baseRef, exec = defaultExec }) {
  const schemaDiff = diffAgainstBase(baseRef, SCHEMA_FILE, exec);
  const migrationsDiff = diffAgainstBase(baseRef, MIGRATIONS_FILE, exec);
  return detectSchemaContractionWithMigration({ schemaDiff, migrationsDiff });
}

/**
 * @param {{ removedFields: string[], addedMigrations: string[] }} result
 */
export function formatViolationMessage(result) {
  return (
    'BLOCKED: this change removes a schema.ts field and adds its migration ' +
    'in the same PR.\n\n' +
    'Convex validates schema against live data at push time, so contracting ' +
    'the schema and running its migration in the same deploy wedges every ' +
    'future deploy (2026-07-04: PR #298 did exactly this and blocked prod ' +
    'for ~1h until an operator ran a manual expand-migrate-contract dance).\n\n' +
    `Removed field(s):\n${result.removedFields.map((l) => `  - ${l}`).join('\n')}\n\n` +
    `New migration(s):\n${result.addedMigrations.map((l) => `  - ${l}`).join('\n')}\n\n` +
    'Fix: split into two PRs. Ship the migration first, run it against ' +
    'production, THEN ship the schema contraction in a follow-up PR. ' +
    'See docs/convex-migrations.md.'
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const baseRef = process.argv[2];
  if (!baseRef) {
    console.error(
      'Usage: check-schema-migration-sequencing.mjs <base-ref>\n' +
        'Example: check-schema-migration-sequencing.mjs origin/master'
    );
    process.exit(2);
  }

  const result = checkSequencing({ baseRef });

  if (!result.violation) {
    console.log('OK: no schema contraction ships with its own migration.');
    process.exit(0);
  }

  console.error(formatViolationMessage(result));
  process.exit(1);
}
