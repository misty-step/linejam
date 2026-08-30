import { describe, expect, it } from 'vitest';
import { designTokens, type ColorMode } from '@/lib/design';
import { DESIGN_CONTRAST_REQUIREMENTS } from '@/lib/design/contract';

function relativeLuminance(hex: string): number {
  const shorthand = hex.replace('#', '');
  const normalized =
    shorthand.length === 3
      ? shorthand
          .split('')
          .map((channel) => channel + channel)
          .join('')
      : shorthand;
  const [red, green, blue] = [0, 2, 4].map((offset) => {
    const channel = parseInt(normalized.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : Math.pow((channel + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(first: string, second: string): number {
  const [lighter, darker] = [
    relativeLuminance(first),
    relativeLuminance(second),
  ].sort((left, right) => right - left);
  return (lighter + 0.05) / (darker + 0.05);
}

const MODES: ColorMode[] = ['light', 'dark'];

describe('fixed identity contrast', () => {
  for (const mode of MODES) {
    it(`${mode} mode meets every shipped semantic contrast contract`, () => {
      const tokens = designTokens[mode];

      for (const requirement of DESIGN_CONTRAST_REQUIREMENTS) {
        const foreground = tokens[requirement.foreground];
        const background = tokens[requirement.background];

        expect(
          contrastRatio(foreground, background),
          `${mode}: ${requirement.label} (${requirement.foreground} on ${requirement.background})`
        ).toBeGreaterThanOrEqual(requirement.minimum);
      }
    });
  }
});
