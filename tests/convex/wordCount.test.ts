import { describe, it, expect } from 'vitest';
import { countWords } from '../../convex/lib/wordCount';

describe('convex/lib/wordCount', () => {
  it('counts words correctly', () => {
    expect(countWords('hello world')).toBe(2);
    expect(countWords('  spaces  ')).toBe(1);
    expect(countWords('')).toBe(0);
  });
});
