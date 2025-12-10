/**
 * Theme Registry
 *
 * Central registration point for all themes.
 * To add a new theme: import it and add to themeArray.
 */

import type { ThemePreset } from './types';
import { kenyaTheme } from './presets/kenya';
import { monoTheme } from './presets/mono';
import { vintagePaperTheme } from './presets/vintage-paper';
import { hyperTheme } from './presets/hyper';

// ═══════════════════════════════════════════════════════════════════════════
// Theme Registration — Add new themes here
// ═══════════════════════════════════════════════════════════════════════════

const themeArray: ThemePreset[] = [
  kenyaTheme,
  monoTheme,
  vintagePaperTheme,
  hyperTheme,
  // Add new themes here:
  // newTheme,
];

// ═══════════════════════════════════════════════════════════════════════════
// Derived exports (auto-generated from themeArray)
// ═══════════════════════════════════════════════════════════════════════════

/** All registered themes by ID */
export const themes: Record<string, ThemePreset> = Object.fromEntries(
  themeArray.map((t) => [t.id, t])
);

/** List of all valid theme IDs */
export const themeIds: string[] = themeArray.map((t) => t.id);

/** Default theme ID */
export const defaultThemeId = 'kenya';

/** Get a theme by ID */
export function getTheme(id: string): ThemePreset | undefined {
  return themes[id];
}

/** Type guard for valid theme IDs */
export function isValidThemeId(value: unknown): value is string {
  return typeof value === 'string' && themeIds.includes(value);
}

/** Get theme IDs as JSON string (for SSR script) */
export function getThemeIdsForScript(): string {
  return JSON.stringify(themeIds);
}

// Re-export individual themes for direct import
export { kenyaTheme } from './presets/kenya';
export { monoTheme } from './presets/mono';
export { vintagePaperTheme } from './presets/vintage-paper';
export { hyperTheme } from './presets/hyper';
