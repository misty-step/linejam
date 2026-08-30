import { describe, expect, it } from 'vitest';
import { resolveCardColors } from '@/lib/poemCard/colors';

describe('resolveCardColors', () => {
  it('resolves the fixed identity light palette', () => {
    expect(resolveCardColors('light')).toEqual({
      background: '#faf9f7',
      foreground: '#1c1917',
      primary: '#b43a12',
      textMuted: '#57534e',
    });
  });

  it('resolves the fixed identity dark palette', () => {
    expect(resolveCardColors('dark')).toEqual({
      background: '#1c1917',
      foreground: '#faf9f7',
      primary: '#f06b3b',
      textMuted: '#d6d3d1',
    });
  });

  it('defaults to the light color mode', () => {
    expect(resolveCardColors()).toEqual(resolveCardColors('light'));
  });
});
