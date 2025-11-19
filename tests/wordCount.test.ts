import { describe, it, expect } from 'vitest';
import { countWords } from '../lib/wordCount';

describe('countWords', () => {
  it('counts basic words correctly', () => {
    expect(countWords('hello world')).toBe(2);
    expect(countWords('one')).toBe(1);
    expect(countWords('one two three')).toBe(3);
  });

  it('handles punctuation correctly', () => {
    expect(countWords('hello, world!')).toBe(2);
    expect(countWords("hello, world! it's great.")).toBe(4);
    expect(countWords('word.')).toBe(1);
  });

  it('handles emoji correctly', () => {
    expect(countWords('🎉 party time!')).toBe(3);
    expect(countWords('hello 🤖 world')).toBe(3);
  });

  it('handles extra whitespace', () => {
    expect(countWords('  hi  there  ')).toBe(2);
    expect(countWords('hello     world')).toBe(2);
    expect(countWords(' single ')).toBe(1);
  });

  it('handles empty strings', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('   ')).toBe(0);
  });

  it('handles newlines and tabs', () => {
    expect(countWords('hello\nworld')).toBe(2);
    expect(countWords('one\ttwo\tthree')).toBe(3);
    expect(countWords('multi\n\tline\r\ntext')).toBe(3);
  });
});
