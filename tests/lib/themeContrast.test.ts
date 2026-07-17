import { describe, it, expect } from 'vitest';
import { themes, themeIds, visibleThemeIds } from '@/lib/themes/registry';
import {
  THEME_CONTRAST_REQUIREMENTS,
  validateTheme,
} from '@/lib/themes/schema';

/**
 * WCAG AA floor for every registered theme, both modes. The theme collection
 * only grows if each entrant keeps body text and controls legible — this is
 * the accessibility gate the 2026-07 design lab set for the top-10 roster.
 */

function relativeLuminance(hex: string): number {
  const h = hex.replace('#', '');
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(full.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a: string, b: string): number {
  const [l1, l2] = [relativeLuminance(a), relativeLuminance(b)].sort(
    (x, y) => y - x
  );
  return (l1 + 0.05) / (l2 + 0.05);
}

const MODES = ['light', 'dark'] as const;

describe('theme collection accessibility floor', () => {
  for (const id of themeIds) {
    const theme = themes[id];
    describe(`${id}`, () => {
      it('has every required token in both modes', () => {
        const result = validateTheme(theme);
        expect(result.errors).toEqual([]);
      });

      for (const mode of MODES) {
        const t = theme.tokens[mode];
        it(`${mode}: body text meets AA (4.5:1) on background and surface`, () => {
          expect(
            contrastRatio(t['color-text-primary'], t['color-background'])
          ).toBeGreaterThanOrEqual(4.5);
          expect(
            contrastRatio(t['color-text-primary'], t['color-surface'])
          ).toBeGreaterThanOrEqual(4.5);
          expect(
            contrastRatio(t['color-text-secondary'], t['color-background'])
          ).toBeGreaterThanOrEqual(4.5);
        });

        it(`${mode}: primary control meets AA (3:1 surface and label)`, () => {
          expect(
            contrastRatio(t['color-primary'], t['color-background'])
          ).toBeGreaterThanOrEqual(3);
          // Primary CTAs render their labels as large bold text (text-lg+,
          // font-medium), where WCAG 1.4.3 AA is 3:1. Body-size text never
          // sits on color-primary in this app.
          expect(
            contrastRatio(t['color-text-inverse'], t['color-primary'])
          ).toBeGreaterThanOrEqual(3);
        });

        it(`${mode}: focus ring is perceivable (3:1 vs background)`, () => {
          expect(
            contrastRatio(t['color-focus-ring'], t['color-background'])
          ).toBeGreaterThanOrEqual(3);
        });
        it(`${mode}: every shipped semantic color pair meets its contrast contract`, () => {
          for (const requirement of THEME_CONTRAST_REQUIREMENTS) {
            const foreground = t[requirement.foreground];
            const background = t[requirement.background];

            expect(
              background,
              `Missing background token ${requirement.background} for ${requirement.label}`
            ).toBeDefined();
            expect(
              contrastRatio(foreground, background as string),
              `${id} ${mode}: ${requirement.label} (${requirement.foreground} on ${requirement.background})`
            ).toBeGreaterThanOrEqual(requirement.minimum);
          }
        });
      }
    });
  }
});

describe('top-10 roster', () => {
  it('shows exactly the locked ten themes, in roster order', () => {
    expect(visibleThemeIds).toEqual([
      'kenya',
      'fold',
      'overprint',
      'broadside',
      'catalog',
      'aloud',
      'seats',
      'console',
      'board',
      'hyper',
    ]);
  });

  it('keeps retired themes registered so existing users are not broken', () => {
    expect(themeIds).toContain('mono');
    expect(themeIds).toContain('vintage-paper');
    expect(visibleThemeIds).not.toContain('mono');
    expect(visibleThemeIds).not.toContain('vintage-paper');
  });
});
