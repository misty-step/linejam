import { describe, expect, it } from 'vitest';
import { SPARKS, getSpark } from '@/lib/sparks';

describe('getSpark', () => {
  it('is deterministic for the same poem and round', () => {
    const a = getSpark('poem_abc', 3);
    const b = getSpark('poem_abc', 3);
    expect(a).toBe(b);
    expect(SPARKS).toContain(a);
  });

  it('varies across rounds within a poem', () => {
    const sparks = new Set(
      Array.from({ length: 9 }, (_, round) => getSpark('poem_abc', round))
    );
    // Not all nine rounds collapse to one spark.
    expect(sparks.size).toBeGreaterThan(1);
  });

  it('varies across poems for the same round', () => {
    const a = getSpark('poem_one', 0);
    const b = getSpark('poem_two', 0);
    const c = getSpark('poem_three', 0);
    expect(new Set([a, b, c]).size).toBeGreaterThan(1);
  });

  it('always returns a member of the corpus', () => {
    for (let round = 0; round < 9; round++) {
      for (const poem of ['p1', 'p2', 'p3', 'p4', 'p5']) {
        expect(SPARKS).toContain(getSpark(poem, round));
      }
    }
  });

  it('spreads reasonably across the corpus (no degenerate clustering)', () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 1000; i++) {
      const spark = getSpark(`poem_${i}`, i % 9)!;
      counts.set(spark, (counts.get(spark) ?? 0) + 1);
    }
    // A healthy hash touches most of the corpus across 1000 samples.
    expect(counts.size).toBeGreaterThan(SPARKS.length / 2);
  });
});
