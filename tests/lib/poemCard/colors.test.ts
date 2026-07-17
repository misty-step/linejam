import { describe, expect, it } from 'vitest';
import { resolveCardColors } from '@/lib/poemCard/colors';

describe('resolveCardColors', () => {
  it('pins the kenya/light card palette to the registry tokens', () => {
    // Originally pinned to prove the linejam-943 static->registry refactor
    // was byte-identical. Card colors intentionally track the live theme
    // registry, so this pin follows deliberate token changes: linejam-954
    // darkened kenya's light primary (#e85d2b -> #b43a12) to meet the 4.5:1
    // small-text contrast floor.
    expect(resolveCardColors('kenya', 'light')).toEqual({
      background: '#faf9f7',
      foreground: '#1c1917',
      primary: '#b43a12',
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
