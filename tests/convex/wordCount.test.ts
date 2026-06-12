import { describe, it, expect } from 'vitest';
import { countWords, getLastWord } from '../../convex/lib/wordCount';

describe('convex/lib/wordCount', () => {
  it('counts words correctly', () => {
    expect(countWords('hello world')).toBe(2);
    expect(countWords('  spaces  ')).toBe(1);
    expect(countWords('')).toBe(0);
  });
});

describe('getLastWord', () => {
  it('returns the final word of a line', () => {
    expect(getLastWord('the silver moon')).toBe('moon');
    expect(getLastWord('moon')).toBe('moon');
  });

  it('strips trailing punctuation but keeps inner apostrophes and hyphens', () => {
    expect(getLastWord('goodnight, moon!')).toBe('moon');
    expect(getLastWord("it's the cat's...")).toBe("cat's");
    expect(getLastWord('half-light?')).toBe('half-light');
  });

  it('handles whitespace and empty input', () => {
    expect(getLastWord('  moon  ')).toBe('moon');
    expect(getLastWord('')).toBeUndefined();
    expect(getLastWord('   ')).toBeUndefined();
  });

  it('falls back to the raw token when it is all punctuation', () => {
    expect(getLastWord('wait —')).toBe('—');
  });
});
