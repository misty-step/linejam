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
import { foldTheme } from './presets/fold';
import { overprintTheme } from './presets/overprint';
import { broadsideTheme } from './presets/broadside';
import { catalogTheme } from './presets/catalog';
import { aloudTheme } from './presets/aloud';
import { seatsTheme } from './presets/seats';
import { consoleTheme } from './presets/console';
import { boardTheme } from './presets/board';

// ═══════════════════════════════════════════════════════════════════════════
// Theme Registration — Add new themes here
// ═══════════════════════════════════════════════════════════════════════════

// Order is the picker order: the top-10 roster from the 2026-07 design lab
// (5 light, then 5 dark), with retired themes registered last.
const themeArray: ThemePreset[] = [
  kenyaTheme,
  foldTheme,
  overprintTheme,
  broadsideTheme,
  catalogTheme,
  aloudTheme,
  seatsTheme,
  consoleTheme,
  boardTheme,
  hyperTheme,
  // Retired: hidden from pickers, kept working for users who chose them.
  monoTheme,
  vintagePaperTheme,
];

// ═══════════════════════════════════════════════════════════════════════════
// Derived exports (auto-generated from themeArray)
// ═══════════════════════════════════════════════════════════════════════════

/** All registered themes by ID */
export const themes: Record<string, ThemePreset> = Object.fromEntries(
  themeArray.map((t) => [t.id, t])
);

/** List of all valid theme IDs (includes retired themes) */
export const themeIds: string[] = themeArray.map((t) => t.id);

/** Theme IDs offered by pickers (retired themes excluded) */
export const visibleThemeIds: string[] = themeArray
  .filter((t) => !t.retired)
  .map((t) => t.id);

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
