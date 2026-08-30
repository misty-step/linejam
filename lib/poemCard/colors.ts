import { designTokens, type ColorMode } from '@/lib/design';

export interface CardColors {
  background: string;
  foreground: string;
  primary: string;
  /** Secondary metadata text uses the stronger secondary text token. */
  textMuted: string;
}

/**
 * Resolve the four flat colors the poem card renderer needs from the fixed
 * identity's light or dark design tokens.
 */
export function resolveCardColors(mode: ColorMode = 'light'): CardColors {
  const tokens = designTokens[mode];

  return {
    background: tokens['color-background'],
    foreground: tokens['color-foreground'],
    primary: tokens['color-primary'],
    textMuted: tokens['color-text-secondary'],
  };
}
