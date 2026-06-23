import { describe, expect, it } from 'vitest';
import {
  WORD_COUNTS,
  getFinalRoundIndex,
  isPresenceStale,
} from '../../convex/lib/gameRules';

describe('gameRules', () => {
  it('is one game: the 1·2·3·4·5·4·3·2·1 paper-fold', () => {
    expect([...WORD_COUNTS]).toEqual([1, 2, 3, 4, 5, 4, 3, 2, 1]);
  });

  it('opens and closes on a single word — the read-aloud bookends', () => {
    expect(WORD_COUNTS[0]).toBe(1);
    expect(WORD_COUNTS[WORD_COUNTS.length - 1]).toBe(1);
  });

  describe('getFinalRoundIndex', () => {
    const matrixOf = (rounds: number) =>
      Array.from({ length: rounds }, () => []);

    it('is the last index of a new game (nine rounds)', () => {
      expect(getFinalRoundIndex(matrixOf(WORD_COUNTS.length))).toBe(8);
    });

    it("honors a legacy game's own (shorter) matrix, not a global constant", () => {
      // A pre-consolidation "quick jam" game shipped a 5-round matrix; it must
      // still complete against its own structure, not crash expecting 9.
      expect(getFinalRoundIndex(matrixOf(5))).toBe(4);
    });
  });

  describe('isPresenceStale', () => {
    const now = 1_000_000;

    it('treats a missing heartbeat as stale', () => {
      expect(isPresenceStale(undefined, now, 45_000)).toBe(true);
    });

    it('is fresh within the threshold and stale past it', () => {
      expect(isPresenceStale(now - 10_000, now, 45_000)).toBe(false);
      expect(isPresenceStale(now - 45_000, now, 45_000)).toBe(false); // exactly at edge
      expect(isPresenceStale(now - 45_001, now, 45_000)).toBe(true);
    });

    it('respects the caller-supplied threshold', () => {
      const lastSeen = now - 5 * 60_000; // 5 minutes ago
      expect(isPresenceStale(lastSeen, now, 45_000)).toBe(true); // away threshold
      expect(isPresenceStale(lastSeen, now, 10 * 60_000)).toBe(false); // abandonment threshold
    });
  });
});
