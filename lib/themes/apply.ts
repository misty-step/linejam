import type { ThemeMode, ThemeTokens } from './types';
import { getTheme, isValidThemeId, defaultThemeId } from './registry';

/**
 * Apply a theme to the document root element.
 *
 * Sets CSS variables from flat token map, data-theme attribute, and mode class.
 * Token keys map directly to CSS variable names (e.g., 'color-primary' -> --color-primary).
 */
export function applyTheme(
  themeId: string,
  mode: ThemeMode,
  options: { transition?: boolean } = { transition: true }
): void {
  if (typeof document === 'undefined') return;

  const theme = getTheme(themeId);
  if (!theme) {
    console.warn(`Theme "${themeId}" not found, using default`);
    applyTheme(defaultThemeId, mode, options);
    return;
  }

  const tokens: ThemeTokens = theme.tokens[mode];
  const root = document.documentElement;

  // Add transition class for smooth crossfade
  if (options.transition) {
    root.classList.add('theme-transitioning');
  }

  // Generic loop - token keys ARE CSS variable names
  for (const [key, value] of Object.entries(tokens)) {
    if (value != null && value !== '') {
      root.style.setProperty(`--${key}`, value);
    }
  }

  // Set data attributes and classes
  root.setAttribute('data-theme', themeId);
  root.classList.remove('light', 'dark');
  root.classList.add(mode);

  // Remove transition class after animation
  if (options.transition) {
    setTimeout(() => {
      root.classList.remove('theme-transitioning');
    }, 300);
  }
}

/**
 * Read the currently applied theme from document root.
 * Returns null if no valid theme is detected.
 */
export function getAppliedTheme(): {
  themeId: string;
  mode: ThemeMode;
} | null {
  if (typeof document === 'undefined') return null;

  const root = document.documentElement;
  const themeId = root.getAttribute('data-theme');
  const mode: ThemeMode = root.classList.contains('dark') ? 'dark' : 'light';

  if (themeId && isValidThemeId(themeId)) {
    return { themeId, mode };
  }

  return null;
}
