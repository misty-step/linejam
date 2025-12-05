import type { ThemePreset, ThemeRegistry, ThemeId } from '../types';
import { kenyaTheme } from './kenya';
import { monoTheme } from './mono';
import { vintagePaperTheme } from './vintage-paper';

export const themes: ThemeRegistry = {
  kenya: kenyaTheme,
  mono: monoTheme,
  'vintage-paper': vintagePaperTheme,
};

export const themeIds: ThemeId[] = ['kenya', 'mono', 'vintage-paper'];
export const defaultThemeId: ThemeId = 'kenya';

export function getTheme(id: ThemeId): ThemePreset {
  return themes[id];
}

export function isValidThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && themeIds.includes(value as ThemeId);
}

// Re-export individual themes for direct import
export { kenyaTheme } from './kenya';
export { monoTheme } from './mono';
export { vintagePaperTheme } from './vintage-paper';
