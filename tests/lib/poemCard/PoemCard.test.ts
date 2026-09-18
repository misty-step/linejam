import { describe, expect, it } from 'vitest';
import {
  formatAttribution,
  poemFullCardElement,
  type AttributedLine,
} from '@/lib/poemCard/PoemCard';
import { resolveCardColors } from '@/lib/poemCard/colors';
import { getCardFontPairing } from '@/lib/poemCard/fonts';

describe('formatAttribution', () => {
  it('names every unique author, in order of first appearance', () => {
    const lines: AttributedLine[] = [
      { text: 'Rain', authorName: 'Emily' },
      { text: 'on rooftops', authorName: 'Marcus' },
      { text: 'counts the hours', authorName: 'Emily' },
    ];

    expect(formatAttribution(lines)).toBe('Emily, Marcus');
  });

  it('returns an empty string for an unattributed poem', () => {
    expect(formatAttribution([])).toBe('');
  });
});

describe('poemFullCardElement', () => {
  it('keeps every complete line and human author in the download', () => {
    const lines = [
      { text: 'moon'.repeat(60), authorName: 'Ada' },
      { text: 'still listening', authorName: 'Ben' },
      { text: 'the last line stays', authorName: 'Cy' },
    ];
    const element = poemFullCardElement({
      lines,
      poemNumber: 1,
      colors: resolveCardColors('light'),
      fonts: getCardFontPairing(),
    });
    const serialized = JSON.stringify(element);
    for (const line of lines) {
      expect(serialized).toContain(line.text);
      expect(serialized).toContain(line.authorName);
    }
  });
});
