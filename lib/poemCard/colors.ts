import { getTheme } from '../themes/registry';
import { DEFAULT_CARD_THEME_ID } from './fonts';

export type CardMode = 'light' | 'dark';

export interface CardColors {
  background: string;
  foreground: string;
  primary: string;
  /** Secondary/muted metadata text — matches the legacy static card's
   *  "textMuted" role, which reads from each theme's `color-text-secondary`
   *  (not `color-text-muted`, which is too faint for a 24px metadata row). */
  textMuted: string;
}

/**
 * Resolve the four flat colors the poem card renderer needs from a theme
 * registry entry, defaulting to kenya/light (the values the original static
 * `lib/tokens.ts` hardcoded) when the theme id or mode is unrecognized.
 */
export function resolveCardColors(
  themeId: string | undefined,
  mode: CardMode | undefined
): CardColors {
  const theme =
    getTheme(themeId ?? DEFAULT_CARD_THEME_ID) ??
    getTheme(DEFAULT_CARD_THEME_ID);
  const resolvedMode: CardMode = mode === 'dark' ? 'dark' : 'light';
  const tokens = theme!.tokens[resolvedMode];

  return {
    background: tokens['color-background'],
    foreground: tokens['color-foreground'],
    primary: tokens['color-primary'],
    textMuted: tokens['color-text-secondary'],
  };
}
