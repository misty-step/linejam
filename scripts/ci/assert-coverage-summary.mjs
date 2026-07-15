#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DEFAULT_SUMMARY_URL = new URL(
  '../../coverage/coverage-summary.json',
  import.meta.url
);
const METRICS = ['lines', 'statements', 'functions', 'branches'];

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
}

/**
 * Vitest considers an empty V8 coverage universe threshold-safe. Reject it
 * explicitly so path-sensitive exclusions or broken instrumentation cannot
 * turn the 85% gate into a green 0/0 receipt.
 */
export function assertCoverageSummary(candidate) {
  assertObject(candidate, 'Coverage summary');
  assertObject(candidate.total, 'Coverage summary total');

  const receipt = {};
  const empty = [];

  for (const name of METRICS) {
    const metric = candidate.total[name];
    if (!metric) {
      throw new Error(`Coverage summary is missing metric: ${name}.`);
    }
    assertObject(metric, `Coverage metric ${name}`);

    const { total, covered, pct } = metric;
    if (
      !Number.isInteger(total) ||
      total < 0 ||
      !Number.isInteger(covered) ||
      covered < 0 ||
      covered > total
    ) {
      throw new Error(
        `Coverage metric ${name} has invalid covered/total counts.`
      );
    }
    if (total === 0) {
      empty.push(name);
      continue;
    }
    if (
      typeof pct !== 'number' ||
      !Number.isFinite(pct) ||
      pct < 0 ||
      pct > 100
    ) {
      throw new Error(`Coverage metric ${name} has an invalid percentage.`);
    }
    const expectedPct = Math.floor((covered * 10_000) / total) / 100;
    if (pct !== expectedPct) {
      throw new Error(
        `Coverage metric ${name} percentage does not match its counts.`
      );
    }

    receipt[name] = { total, covered, pct };
  }

  if (empty.length > 0) {
    throw new Error(`Coverage totals must be nonzero: ${empty.join(', ')}.`);
  }

  return receipt;
}

/** @param {string | URL} [path] */
export function loadCoverageSummary(path = DEFAULT_SUMMARY_URL) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    throw new Error('Coverage summary could not be read as JSON.');
  }
  return assertCoverageSummary(parsed);
}

function main(argv = process.argv.slice(2)) {
  const receipt = loadCoverageSummary(argv[0] || DEFAULT_SUMMARY_URL);
  console.log(
    `READY: coverage measured ${METRICS.map((name) => `${name}=${receipt[name].covered}/${receipt[name].total} (${receipt[name].pct}%)`).join('; ')}`
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    main();
  } catch (error) {
    console.error(error?.message || error);
    process.exit(1);
  }
}
