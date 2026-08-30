import { describe, expect, it } from 'vitest';
import { designTokens, type ColorMode } from '@/lib/design';

const MODES: ColorMode[] = ['light', 'dark'];

describe('fixed design contract', () => {
  it('ships the Ink & Anticipation color identity', () => {
    expect(designTokens.light).toMatchObject({
      'color-primary': '#b43a12',
      'color-focus-ring': '#e85d2b',
      'color-background': '#faf9f7',
      'color-surface': '#ffffff',
      'color-foreground': '#1c1917',
    });
    expect(designTokens.dark).toMatchObject({
      'color-primary': '#f06b3b',
      'color-focus-ring': '#e85d2b',
      'color-background': '#1c1917',
      'color-surface': '#292524',
      'color-foreground': '#faf9f7',
    });
  });

  it('uses one fixed type system in both modes', () => {
    for (const mode of MODES) {
      expect(designTokens[mode]).toMatchObject({
        'font-display': 'var(--font-libre-baskerville)',
        'font-sans': 'var(--font-ibm-plex)',
        'font-mono': 'var(--font-jetbrains-mono)',
      });
    }
  });

  it('keeps the token shape identical across modes', () => {
    expect(Object.keys(designTokens.dark).sort()).toEqual(
      Object.keys(designTokens.light).sort()
    );
  });
});
