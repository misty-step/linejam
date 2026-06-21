import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GAME_MODE,
  GAME_MODES,
  WORD_COUNTS,
  getFinalRoundIndex,
  getGameRules,
  isGameMode,
  isPresenceStale,
  normalizeGameMode,
} from '../../convex/lib/gameRules';

describe('gameRules', () => {
  it('exposes the three launch modes', () => {
    expect(GAME_MODES).toEqual(['classic', 'rhyme', 'quick']);
    expect(DEFAULT_GAME_MODE).toBe('classic');
  });

  it('keeps the classic shape as the legacy WORD_COUNTS', () => {
    expect(getGameRules('classic').wordCounts).toEqual([
      1, 2, 3, 4, 5, 4, 3, 2, 1,
    ]);
    expect(getGameRules('classic').wordCounts).toEqual([...WORD_COUNTS]);
  });

  it('gives rhyme relay the classic shape plus the rhyme twist', () => {
    const rules = getGameRules('rhyme');
    expect(rules.wordCounts).toEqual([1, 2, 3, 4, 5, 4, 3, 2, 1]);
    expect(rules.finalRhyme).toBe(true);
  });

  it('gives quick jam a five-round palindrome', () => {
    const rules = getGameRules('quick');
    expect(rules.wordCounts).toEqual([1, 2, 3, 2, 1]);
    expect(rules.finalRhyme).toBe(false);
    expect(getFinalRoundIndex(rules)).toBe(4);
  });

  it('every mode has a label, tagline, and a sane palindrome shape', () => {
    for (const mode of GAME_MODES) {
      const rules = getGameRules(mode);
      expect(rules.mode).toBe(mode);
      expect(rules.label.length).toBeGreaterThan(0);
      expect(rules.tagline.length).toBeGreaterThan(0);
      expect(rules.wordCounts.length).toBeGreaterThanOrEqual(3);
      rules.wordCounts.forEach((count) => {
        expect(Number.isInteger(count)).toBe(true);
        expect(count).toBeGreaterThanOrEqual(1);
        expect(count).toBeLessThanOrEqual(5);
      });
      // Opening and closing lines are single words: the read-aloud bookends.
      expect(rules.wordCounts[0]).toBe(1);
      expect(rules.wordCounts[rules.wordCounts.length - 1]).toBe(1);
    }
  });

  it('normalizes legacy and junk modes to classic', () => {
    expect(normalizeGameMode(undefined)).toBe('classic');
    expect(normalizeGameMode(null)).toBe('classic');
    expect(normalizeGameMode('')).toBe('classic');
    expect(normalizeGameMode('sonnet-battle')).toBe('classic');
    expect(normalizeGameMode('rhyme')).toBe('rhyme');
    expect(getGameRules(undefined).mode).toBe('classic');
    expect(getGameRules('quick').mode).toBe('quick');
  });

  it('type-guards mode strings', () => {
    expect(isGameMode('classic')).toBe(true);
    expect(isGameMode('quick')).toBe(true);
    expect(isGameMode('CLASSIC')).toBe(false);
    expect(isGameMode(42)).toBe(false);
    expect(isGameMode(null)).toBe(false);
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
