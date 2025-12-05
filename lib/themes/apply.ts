import type { ThemeId, ThemeMode, ThemeStyleProps } from './types';
import { themes, isValidThemeId, defaultThemeId } from './presets';

/**
 * Convert camelCase to kebab-case for CSS variable names
 */
function kebabCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

/**
 * Apply a theme to the document root element.
 *
 * Sets CSS variables, data-theme attribute, and mode class.
 * Optionally triggers a 300ms crossfade transition.
 */
export function applyTheme(
  themeId: ThemeId,
  mode: ThemeMode,
  options: { transition?: boolean } = { transition: true }
): void {
  if (typeof document === 'undefined') return;

  const theme = themes[themeId];
  if (!theme) {
    console.warn(`Theme "${themeId}" not found, using default`);
    applyTheme(defaultThemeId, mode, options);
    return;
  }

  const styleProps: ThemeStyleProps = theme.styles[mode];
  const root = document.documentElement;

  // Add transition class for smooth crossfade
  if (options.transition) {
    root.classList.add('theme-transitioning');
  }

  // Apply color variables
  for (const [key, value] of Object.entries(styleProps.colors)) {
    if (value) {
      root.style.setProperty(`--color-${kebabCase(key)}`, value);
    }
  }

  // Apply font variables
  root.style.setProperty('--font-display', styleProps.fonts.display);
  root.style.setProperty('--font-sans', styleProps.fonts.sans);
  root.style.setProperty('--font-mono', styleProps.fonts.mono);

  // Apply shadow variables
  root.style.setProperty('--shadow-sm', styleProps.shadows.sm);
  root.style.setProperty('--shadow-md', styleProps.shadows.md);
  root.style.setProperty('--shadow-lg', styleProps.shadows.lg);
  if (styleProps.shadows.color) {
    root.style.setProperty('--shadow-color', styleProps.shadows.color);
  }

  // Apply radius variables
  root.style.setProperty('--radius-sm', styleProps.radius.sm);
  root.style.setProperty('--radius-md', styleProps.radius.md);
  root.style.setProperty('--radius-lg', styleProps.radius.lg);
  root.style.setProperty('--radius-full', styleProps.radius.full);

  // Apply spacing variables
  root.style.setProperty('--space-1', styleProps.spacing[1]);
  root.style.setProperty('--space-2', styleProps.spacing[2]);
  root.style.setProperty('--space-3', styleProps.spacing[3]);
  root.style.setProperty('--space-4', styleProps.spacing[4]);
  root.style.setProperty('--space-5', styleProps.spacing[5]);
  root.style.setProperty('--space-6', styleProps.spacing[6]);
  root.style.setProperty('--space-7', styleProps.spacing[7]);
  root.style.setProperty('--space-8', styleProps.spacing[8]);

  // Apply transition variables
  root.style.setProperty('--duration-instant', styleProps.transitions.instant);
  root.style.setProperty('--duration-fast', styleProps.transitions.fast);
  root.style.setProperty('--duration-normal', styleProps.transitions.normal);
  root.style.setProperty('--duration-slow', styleProps.transitions.slow);
  root.style.setProperty('--ease-theme', styleProps.transitions.easing);
  root.style.setProperty('--ease-in', styleProps.transitions.easingIn);
  root.style.setProperty('--ease-out', styleProps.transitions.easingOut);

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
  themeId: ThemeId;
  mode: ThemeMode;
} | null {
  if (typeof document === 'undefined') return null;

  const root = document.documentElement;
  const themeId = root.getAttribute('data-theme');
  const mode: ThemeMode = root.classList.contains('dark') ? 'dark' : 'light';

  if (isValidThemeId(themeId)) {
    return { themeId, mode };
  }

  return null;
}
