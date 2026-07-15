/** @vitest-environment node */
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  assertCoverageSummary,
  loadCoverageSummary,
} from '@/scripts/ci/assert-coverage-summary.mjs';

function metric(total: number, covered: number) {
  return {
    total,
    covered,
    skipped: 0,
    pct: total === 0 ? 'Unknown' : Math.floor((covered * 10_000) / total) / 100,
  };
}

describe('coverage summary guard', () => {
  it('requires a summary object and total object', () => {
    expect(() => assertCoverageSummary(null)).toThrow(
      'Coverage summary must be an object'
    );
    expect(() => assertCoverageSummary({ total: [] })).toThrow(
      'Coverage summary total must be an object'
    );
  });

  it('rejects the fail-open 0/0 summary emitted for an excluded checkout', () => {
    const empty = {
      total: {
        lines: metric(0, 0),
        statements: metric(0, 0),
        functions: metric(0, 0),
        branches: metric(0, 0),
      },
    };

    expect(() => assertCoverageSummary(empty)).toThrow(
      'Coverage totals must be nonzero: lines, statements, functions, branches'
    );
  });

  it('rejects malformed or impossible metric totals', () => {
    expect(() => assertCoverageSummary({ total: {} })).toThrow(
      'Coverage summary is missing metric: lines'
    );
    expect(() =>
      assertCoverageSummary({
        total: {
          lines: metric(2, 3),
          statements: metric(1, 1),
          functions: metric(1, 1),
          branches: metric(1, 1),
        },
      })
    ).toThrow('Coverage metric lines has invalid covered/total counts');
  });

  it.each([
    { total: -1, covered: 0 },
    { total: 1.5, covered: 1 },
    { total: 1, covered: -1 },
    { total: 1, covered: 0.5 },
  ])('rejects invalid integer counts: $total/$covered', (lines) => {
    expect(() =>
      assertCoverageSummary({
        total: {
          lines: { ...metric(1, 1), ...lines },
          statements: metric(1, 1),
          functions: metric(1, 1),
          branches: metric(1, 1),
        },
      })
    ).toThrow('Coverage metric lines has invalid covered/total counts');
  });

  it.each(['Unknown', Number.NaN, -1, 101])(
    'rejects an invalid percentage: %s',
    (pct) => {
      expect(() =>
        assertCoverageSummary({
          total: {
            lines: { ...metric(1, 1), pct },
            statements: metric(1, 1),
            functions: metric(1, 1),
            branches: metric(1, 1),
          },
        })
      ).toThrow('Coverage metric lines has an invalid percentage');
    }
  );

  it('rejects a percentage that contradicts its covered and total counts', () => {
    expect(() =>
      assertCoverageSummary({
        total: {
          lines: { ...metric(100, 50), pct: 99 },
          statements: metric(1, 1),
          functions: metric(1, 1),
          branches: metric(1, 1),
        },
      })
    ).toThrow('Coverage metric lines percentage does not match its counts');
  });

  it('matches the two-decimal flooring used by Istanbul coverage summaries', () => {
    const summary = {
      total: {
        lines: metric(3, 2),
        statements: metric(1, 1),
        functions: metric(1, 1),
        branches: metric(1, 1),
      },
    };

    expect(assertCoverageSummary(summary)).toMatchObject({
      lines: { pct: 66.66 },
    });
    expect(() =>
      assertCoverageSummary({
        total: {
          ...summary.total,
          lines: { ...summary.total.lines, pct: 66.67 },
        },
      })
    ).toThrow('Coverage metric lines percentage does not match its counts');
  });

  it('loads a machine-readable summary and fails closed on invalid JSON', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'linejam-coverage-'));
    const summaryPath = path.join(directory, 'coverage-summary.json');
    const summary = {
      total: {
        lines: metric(100, 91),
        statements: metric(110, 99),
        functions: metric(50, 46),
        branches: metric(200, 171),
      },
    };

    try {
      await writeFile(summaryPath, JSON.stringify(summary));
      expect(loadCoverageSummary(summaryPath)).toEqual(
        assertCoverageSummary(summary)
      );

      await writeFile(summaryPath, '{not-json');
      expect(() => loadCoverageSummary(summaryPath)).toThrow(
        'Coverage summary could not be read as JSON'
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('returns a values-only receipt for a measured summary', () => {
    expect(
      assertCoverageSummary({
        total: {
          lines: metric(100, 91),
          statements: metric(110, 99),
          functions: metric(50, 46),
          branches: metric(200, 171),
        },
      })
    ).toEqual({
      lines: { total: 100, covered: 91, pct: 91 },
      statements: { total: 110, covered: 99, pct: 90 },
      functions: { total: 50, covered: 46, pct: 92 },
      branches: { total: 200, covered: 171, pct: 85.5 },
    });
  });
});
