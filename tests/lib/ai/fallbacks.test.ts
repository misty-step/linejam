import { describe, it, expect } from 'vitest';
import { getFallbackLine } from '../../../convex/lib/ai/fallbacks';
import { countWords } from '../../../lib/wordCount';

/**
 * Core invariant suite for the combinatorial fallback bank (backlog 028).
 *
 * The fallback library composes lines from word pools via per-count templates,
 * so the exact string is seed-dependent — but two contracts must hold for the
 * commit path to stay correct and for fallbacks to rarely repeat in a game:
 *   1. WORD COUNT is ALWAYS exactly the requested count (so commitAssignedLine
 *      never re-substitutes).
 *   2. Varying the seed yields real combinatorial variety per count.
 *   3. The seedless call is stable (same output on repeat).
 */

const SEED_COUNT = 200;
const seeds = Array.from(
  { length: SEED_COUNT },
  (_, i) => `poem-${i}:${i % 9}`
);

describe('getFallbackLine (combinatorial fallback bank)', () => {
  describe('word-count invariant', () => {
    for (let n = 1; n <= 5; n++) {
      it(`always produces exactly ${n} word(s) across ${SEED_COUNT} seeds`, () => {
        for (const seed of seeds) {
          expect(countWords(getFallbackLine(n, seed))).toBe(n);
        }
        // The seedless call must also satisfy the invariant.
        expect(countWords(getFallbackLine(n))).toBe(n);
      });
    }
  });

  describe('combinatorial variety', () => {
    for (let n = 1; n <= 5; n++) {
      it(`produces more than 20 distinct ${n}-word lines across seeds`, () => {
        const distinct = new Set(seeds.map((seed) => getFallbackLine(n, seed)));
        expect(distinct.size).toBeGreaterThan(20);
      });
    }
  });

  describe('seedless stability', () => {
    for (let n = 1; n <= 5; n++) {
      it(`returns the same ${n}-word line on repeat calls without a seed`, () => {
        const first = getFallbackLine(n);
        expect(getFallbackLine(n)).toBe(first);
        expect(getFallbackLine(n)).toBe(first);
        // Same seed → same line, too.
        const seeded = getFallbackLine(n, 'stable-seed');
        expect(getFallbackLine(n, 'stable-seed')).toBe(seeded);
      });
    }
  });
});
