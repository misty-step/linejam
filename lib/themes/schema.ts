/**
 * Theme Schema & Validation
 *
 * Provides the defineTheme factory for creating validated theme presets.
 * All required tokens are listed here - missing tokens throw at dev time.
 */

import type { ThemePreset, ThemeTokens } from './types';

/** All tokens that MUST be defined in every theme */
export const REQUIRED_TOKENS: (keyof ThemeTokens)[] = [
  // Colors (15)
  'color-primary',
  'color-primary-hover',
  'color-primary-active',
  'color-background',
  'color-foreground',
  'color-surface',
  'color-surface-hover',
  'color-muted',
  'color-border',
  'color-border-subtle',
  'color-text-primary',
  'color-text-secondary',
  'color-text-muted',
  'color-text-inverse',
  'color-focus-ring',

  // Fonts (3)
  'font-display',
  'font-sans',
  'font-mono',

  // Typography (18)
  'text-xs',
  'text-sm',
  'text-base',
  'text-md',
  'text-lg',
  'text-xl',
  'text-2xl',
  'text-3xl',
  'text-4xl',
  'text-5xl',
  'leading-tight',
  'leading-normal',
  'leading-relaxed',
  'tracking-tighter',
  'tracking-tight',
  'tracking-normal',
  'tracking-wide',
  'tracking-wider',

  // Shadows (4)
  'shadow-sm',
  'shadow-md',
  'shadow-lg',
  'shadow-color',

  // Radius (4)
  'radius-sm',
  'radius-md',
  'radius-lg',
  'radius-full',

  // Spacing (8)
  'space-1',
  'space-2',
  'space-3',
  'space-4',
  'space-5',
  'space-6',
  'space-7',
  'space-8',

  // Transitions (7)
  'duration-instant',
  'duration-fast',
  'duration-normal',
  'duration-slow',
  'ease-theme',
  'ease-in',
  'ease-out',
];

/** Optional tokens that can be omitted (will use fallbacks) */
export const OPTIONAL_TOKENS: (keyof ThemeTokens)[] = [
  'color-success',
  'color-error',
  'color-warning',
  'color-info',
];

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate that a theme has all required tokens for both modes.
 */
export function validateTheme(theme: ThemePreset): ValidationResult {
  const errors: string[] = [];

  for (const mode of ['light', 'dark'] as const) {
    for (const token of REQUIRED_TOKENS) {
      const value = theme.tokens[mode][token];
      if (value === undefined || value === null || value === '') {
        errors.push(`${mode}.${token}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Type-safe theme factory with dev-time validation.
 *
 * @example
 * ```ts
 * export const myTheme = defineTheme({
 *   id: 'my-theme',
 *   label: 'My Theme',
 *   description: 'A custom theme',
 *   tokens: {
 *     light: { 'color-primary': '#ff0000', ... },
 *     dark: { 'color-primary': '#cc0000', ... },
 *   }
 * });
 * ```
 */
export function defineTheme(preset: ThemePreset): ThemePreset {
  if (process.env.NODE_ENV !== 'production') {
    const result = validateTheme(preset);
    if (!result.valid) {
      const missing = result.errors.slice(0, 5).join(', ');
      const more =
        result.errors.length > 5 ? ` (+${result.errors.length - 5} more)` : '';
      throw new Error(
        `Invalid theme "${preset.id}": Missing tokens: ${missing}${more}`
      );
    }
  }
  return preset;
}
