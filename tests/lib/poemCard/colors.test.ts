import { describe, expect, it } from 'vitest';
import { resolveCardColors } from '@/lib/poemCard/colors';

describe('resolveCardColors', () => {
  it('matches the legacy static kenya/light card palette exactly', () => {
    // These are the hardcoded values lib/tokens.ts shipped before this
    // refactor — the poem opengraph-image route must render byte-identical
    // colors post-refactor (linejam-943), so pin them here.
    expect(resolveCardColors('kenya', 'light')).toEqual({
      background: '#faf9f7',
      foreground: '#1c1917',
      primary: '#e85d2b',
      textMuted: '#57534e',
    });
  });

  it('resolves dark mode from the same theme', () => {
    const dark = resolveCardColors('kenya', 'dark');
    expect(dark.background).toBe('#1c1917');
    expect(dark.foreground).toBe('#faf9f7');
  });

  it('falls back to kenya/light for an unknown theme id', () => {
    expect(resolveCardColors('not-a-real-theme', 'light')).toEqual(
      resolveCardColors('kenya', 'light')
    );
  });

  it('falls back to kenya/light when theme id is undefined', () => {
    expect(resolveCardColors(undefined, undefined)).toEqual(
      resolveCardColors('kenya', 'light')
    );
  });

  it('resolves a distinct palette per theme', () => {
    const kenya = resolveCardColors('kenya', 'light');
    const mono = resolveCardColors('mono', 'light');
    const hyper = resolveCardColors('hyper', 'dark');

    expect(mono.primary).not.toBe(kenya.primary);
    expect(hyper.background).not.toBe(kenya.background);
  });
});
