import { describe, it, expect } from 'vitest';
import {
  normalizeText,
  validateWordCount,
  attemptFix,
} from '../../../convex/lib/ai/wordCountGuard';

describe('Word Count Guard', () => {
  describe('normalizeText', () => {
    it('removes surrounding quotes', () => {
      expect(normalizeText('"hello world"')).toBe('hello world');
      expect(normalizeText("'hello world'")).toBe('hello world');
      expect(normalizeText('"test"')).toBe('test');
    });

    it('normalizes whitespace', () => {
      expect(normalizeText('hello    world')).toBe('hello world');
      expect(normalizeText('  hello  world  ')).toBe('hello world');
      expect(normalizeText('one\t\ttwo')).toBe('one two');
    });

    it('handles newlines', () => {
      expect(normalizeText('hello\nworld')).toBe('hello world');
      expect(normalizeText('one\r\ntwo')).toBe('one two');
    });

    it('handles empty input', () => {
      expect(normalizeText('')).toBe('');
      expect(normalizeText('   ')).toBe('');
    });
  });

  describe('validateWordCount', () => {
    it('validates correct word counts', () => {
      expect(validateWordCount('hello', 1)).toBe(true);
      expect(validateWordCount('hello world', 2)).toBe(true);
      expect(validateWordCount('one two three', 3)).toBe(true);
    });

    it('rejects incorrect word counts', () => {
      expect(validateWordCount('hello', 2)).toBe(false);
      expect(validateWordCount('hello world', 1)).toBe(false);
      expect(validateWordCount('one two three', 5)).toBe(false);
    });

    it('handles edge cases', () => {
      expect(validateWordCount('', 0)).toBe(true);
      expect(validateWordCount('   ', 0)).toBe(true);
    });
  });

  describe('attemptFix', () => {
    it('returns normalized text if word count already matches', () => {
      expect(attemptFix('hello world', 2)).toBe('hello world');
      expect(attemptFix('"hello world"', 2)).toBe('hello world');
      expect(attemptFix('  one  ', 1)).toBe('one');
    });

    it('truncates when too many words', () => {
      expect(attemptFix('one two three four', 3)).toBe('one two three');
      expect(attemptFix('a b c d e', 2)).toBe('a b');
    });

    it('returns null when too few words', () => {
      expect(attemptFix('hello', 2)).toBeNull();
      expect(attemptFix('one two', 5)).toBeNull();
    });

    it('handles empty input correctly', () => {
      expect(attemptFix('', 0)).toBe('');
      expect(attemptFix('', 1)).toBeNull();
    });
  });
});
