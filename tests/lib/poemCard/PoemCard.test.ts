import { describe, expect, it } from 'vitest';
import {
  computeFullCardSize,
  formatAttribution,
  FULL_CARD_WIDTH,
  poemFullCardElement,
  type AttributedLine,
} from '@/lib/poemCard/PoemCard';

describe('formatAttribution', () => {
  it('names every unique author, in order of first appearance', () => {
    const lines: AttributedLine[] = [
      { text: 'Rain', authorName: 'Emily', isBot: false },
      { text: 'on rooftops', authorName: 'Marcus', isBot: false },
      { text: 'counts the hours', authorName: 'Emily', isBot: false },
    ];

    expect(formatAttribution(lines)).toBe('Emily, Marcus');
  });

  it('marks AI authors with an (AI) suffix', () => {
    const lines: AttributedLine[] = [
      { text: 'Rain', authorName: 'Emily', isBot: false },
      { text: 'on rooftops', authorName: 'Wendell', isBot: true },
    ];

    expect(formatAttribution(lines)).toBe('Emily, Wendell (AI)');
  });

  it('deduplicates a human and an AI author who happen to share a name', () => {
    const lines: AttributedLine[] = [
      { text: 'a', authorName: 'Alex', isBot: false },
      { text: 'b', authorName: 'Alex', isBot: true },
    ];

    // Same display name but different kind is not the same "author" for
    // attribution purposes — both entries must survive, distinctly tagged.
    expect(formatAttribution(lines)).toBe('Alex, Alex (AI)');
  });

  it('returns an empty string for an unattributed poem', () => {
    expect(formatAttribution([])).toBe('');
  });
});

describe('computeFullCardSize', () => {
  it('never shrinks below the fixed preview card height', () => {
    expect(computeFullCardSize(0).height).toBeGreaterThanOrEqual(630);
    expect(computeFullCardSize(1).height).toBeGreaterThanOrEqual(630);
  });

  it('grows with line count so a nine-line poem stays legible', () => {
    const short = computeFullCardSize(2);
    const long = computeFullCardSize(9);

    expect(long.height).toBeGreaterThan(short.height);
  });

  it('keeps a fixed width across all line counts', () => {
    expect(computeFullCardSize(1).width).toBe(FULL_CARD_WIDTH);
    expect(computeFullCardSize(20).width).toBe(FULL_CARD_WIDTH);
  });
});

describe('poemFullCardElement', () => {
  it('renders the Linejam metadata cleanly when attribution is absent', () => {
    const element = poemFullCardElement({
      lines: [],
      poemNumber: 1,
      colors: {
        background: '#fff',
        foreground: '#000',
        primary: '#f00',
        textMuted: '#666',
      },
      fonts: {
        displayFamily: 'Georgia',
        sansFamily: 'Arial',
        displayUrl: 'https://example.com/display.woff',
        sansUrl: 'https://example.com/sans.woff',
      },
    });

    const serialized = JSON.stringify(element);
    expect(serialized).toContain('linejam.app');
    expect(serialized).not.toContain(' · linejam.app');
  });
});
