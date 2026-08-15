#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const SCHEMA_FILE = 'convex/schema.ts';
const MIGRATIONS_FILE = 'convex/migrations.ts';
const SCHEMA_PROPERTY = /^([A-Za-z_$][\w$]*)\s*:/;
const MIGRATION_EXPORT =
  /^\+\s*export const ([A-Za-z_$][\w$]*)\s*=\s*(?:(?:\r?\n)\+\s*)?(internalMutation|mutation|internalAction|action)\s*\(/gm;

function schemaChangeBlocks(diff) {
  const blocks = [];
  let current = null;

  for (const line of diff.split('\n')) {
    const marker = line[0];
    const isChange =
      (marker === '+' || marker === '-') &&
      !line.startsWith(marker.repeat(3));
    if (!isChange) {
      current = null;
      continue;
    }
    if (current === null) {
      current = { before: [], after: [] };
      blocks.push(current);
    }
    current[marker === '-' ? 'before' : 'after'].push(
      line.slice(1).trim()
    );
  }

  return blocks;
}

function literalUnionValues(lines, field, occurrence) {
  const fieldPrefix = `${field}:`;
  let seen = 0;
  const start = lines.findIndex((line) => {
    if (!line.startsWith(fieldPrefix)) return false;
    if (seen === occurrence) return true;
    seen++;
    return false;
  });
  if (start === -1) return null;

  const expressionLines = [];
  let depth = 0;
  let opened = false;
  for (const line of lines.slice(start)) {
    const expression =
      expressionLines.length === 0 ? line.slice(fieldPrefix.length) : line;
    expressionLines.push(expression);
    for (const character of expression) {
      if (character === '(') {
        depth++;
        opened = true;
      } else if (character === ')') {
        depth--;
      }
    }
    if (opened && depth === 0) break;
  }

  const expression = expressionLines.join('').replaceAll(/\s/g, '');
  const literalPattern = /v\.literal\((['"])([^'"]+)\1\)/g;
  const values = Array.from(
    expression.matchAll(literalPattern),
    ([, , value]) => value
  );
  const skeleton = expression.replace(literalPattern, 'L');
  if (values.length === 0 || !/^v\.union\((?:L,?)+\),?$/.test(skeleton)) {
    return null;
  }
  return new Set(values);
}

function isLiteralUnionExpansion(block, field, occurrence) {
  const before = literalUnionValues(block.before, field, occurrence);
  const after = literalUnionValues(block.after, field, occurrence);
  return (
    before !== null &&
    after !== null &&
    after.size > before.size &&
    [...before].every((value) => after.has(value))
  );
}

function addedMigrationExports(diff) {
  return Array.from(
    diff.matchAll(MIGRATION_EXPORT),
    ([, name, kind]) => `export const ${name} = ${kind}(`
  );
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
  const removedFields = [];
  for (const block of schemaChangeBlocks(schemaDiff)) {
    const fieldOccurrences = new Map();
    for (const line of block.before) {
      const field = SCHEMA_PROPERTY.exec(line)?.[1];
      if (field === undefined) continue;
      const occurrence = fieldOccurrences.get(field) ?? 0;
      fieldOccurrences.set(field, occurrence + 1);
      if (!isLiteralUnionExpansion(block, field, occurrence)) {
        removedFields.push(field);
      }
    }
  }
  const addedMigrations = addedMigrationExports(migrationsDiff);

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
