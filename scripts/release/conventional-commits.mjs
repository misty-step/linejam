#!/usr/bin/env node
import { execFileSync } from 'node:child_process';

// Matches "type(scope)!: subject" or "type: subject". `!` marks a breaking
// change per the Conventional Commits spec.
const HEADER_PATTERN = /^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/;

const KNOWN_TYPES = new Set([
  'feat',
  'fix',
  'perf',
  'refactor',
  'docs',
  'chore',
  'style',
  'test',
  'build',
  'ci',
]);

// Commits authored BY the release automation itself carry no product
// content and would pollute the changelog with noise about the changelog.
const AUTOMATION_SCOPES = new Set(['release', 'feed']);

const PR_NUMBER_PATTERN = /\(#(\d+)\)\s*$/;
const BREAKING_FOOTER_PATTERN = /BREAKING[ -]CHANGE:\s*(.+)/is;

const RECORD_SEPARATOR = '\x1e';
const FIELD_SEPARATOR = '\x1f';

/**
 * @param {string} subject
 * @param {string} body
 * @returns {{ type: string, scope?: string, breaking: boolean, description: string, pr?: number } | null}
 */
export function parseConventionalCommit(subject, body = '') {
  const match = HEADER_PATTERN.exec(subject.trim());
  if (!match) return null;

  const [, type, scope, bang, rest] = match;
  if (!KNOWN_TYPES.has(type)) return null;
  if (scope && AUTOMATION_SCOPES.has(scope)) return null;

  const prMatch = PR_NUMBER_PATTERN.exec(rest);
  const description = (prMatch ? rest.slice(0, prMatch.index) : rest).trim();
  const breaking = Boolean(bang) || BREAKING_FOOTER_PATTERN.test(body);

  return {
    type,
    ...(scope ? { scope } : {}),
    breaking,
    description,
    ...(prMatch ? { pr: Number(prMatch[1]) } : {}),
  };
}

/**
 * @param {{ hash: string, subject: string, body: string }} commit
 * @returns {import('../../lib/releases/types').ChangelogEntry | null}
 */
export function commitToChangelogEntry({ hash, subject, body }) {
  const parsed = parseConventionalCommit(subject, body);
  if (!parsed) return null;

  return { ...parsed, commit: hash.slice(0, 7) };
}

/**
 * @param {string} range e.g. "v1.14.0..v1.15.0" or "v1.15.0.."
 * @param {(command: string, args: string[]) => string} exec
 */
export function deriveChangesForRange(range, exec = defaultExec) {
  const raw = exec('git', [
    'log',
    range,
    `--pretty=format:%H${FIELD_SEPARATOR}%s${FIELD_SEPARATOR}%b${RECORD_SEPARATOR}`,
  ]);

  return raw
    .split(RECORD_SEPARATOR)
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [hash, subject, body = ''] = record.split(FIELD_SEPARATOR);
      return commitToChangelogEntry({ hash, subject, body });
    })
    .filter((entry) => entry !== null)
    .reverse(); // oldest first, matching the order commits landed
}

function defaultExec(command, args) {
  return execFileSync(command, args, { encoding: 'utf8' });
}
