/**
 * Theme Schema & Validation
 *
 * Provides the defineTheme factory for creating validated theme presets.
 * All required tokens are listed here - missing tokens throw at dev time.
 */

import type { ThemePreset, ThemeTokens } from './types';

/** All tokens that MUST be defined in every theme */
export const REQUIRED_TOKENS: (keyof ThemeTokens)[] = [
  // Colors (19)
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
  'color-success',
  'color-error',
  'color-warning',
  'color-info',

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

/**
 * Contrast pairs used by shipped components. Keep this contract next to the
 * theme schema so new themes cannot pass token validation while regressing a
 * semantic text, status, or control surface.
 */
export const THEME_CONTRAST_REQUIREMENTS = [
  {
    foreground: 'color-text-primary',
    background: 'color-background',
    minimum: 4.5,
    label: 'body text on the app background',
  },
  {
    foreground: 'color-text-primary',
    background: 'color-surface',
    minimum: 4.5,
    label: 'body text on elevated surfaces',
  },
  {
    foreground: 'color-text-secondary',
    background: 'color-background',
    minimum: 4.5,
    label: 'secondary text on the app background',
  },
  {
    foreground: 'color-text-secondary',
    background: 'color-surface',
    minimum: 4.5,
    label: 'secondary text on elevated surfaces',
  },
  {
    foreground: 'color-text-muted',
    background: 'color-background',
    minimum: 4.5,
    label: 'muted text on the app background',
  },
  {
    foreground: 'color-text-muted',
    background: 'color-surface',
    minimum: 4.5,
    label: 'muted text on elevated surfaces',
  },
  {
    foreground: 'color-text-muted',
    background: 'color-muted',
    minimum: 4.5,
    label: 'muted text on muted controls',
  },
  {
    foreground: 'color-primary',
    background: 'color-background',
    minimum: 4.5,
    label: 'primary action text on the app background',
  },
  {
    foreground: 'color-primary',
    background: 'color-surface',
    minimum: 4.5,
    label: 'primary links on elevated surfaces',
  },
  {
    foreground: 'color-text-inverse',
    background: 'color-primary',
    minimum: 4.5,
    label: 'primary action label',
  },
  {
    foreground: 'color-text-inverse',
    background: 'color-primary-hover',
    minimum: 4.5,
    label: 'primary action label on hover',
  },
  {
    foreground: 'color-text-inverse',
    background: 'color-primary-active',
    minimum: 4.5,
    label: 'primary action label while pressed',
  },
  {
    foreground: 'color-focus-ring',
    background: 'color-background',
    minimum: 3,
    label: 'focus ring on the app background',
  },
  {
    foreground: 'color-focus-ring',
    background: 'color-surface',
    minimum: 3,
    label: 'focus ring on elevated surfaces',
  },
  {
    foreground: 'color-success',
    background: 'color-background',
    minimum: 4.5,
    label: 'success status text on the app background',
  },
  {
    foreground: 'color-error',
    background: 'color-background',
    minimum: 4.5,
    label: 'error status text on the app background',
  },
  {
    foreground: 'color-warning',
    background: 'color-background',
    minimum: 4.5,
    label: 'warning status text on the app background',
  },
  {
    foreground: 'color-info',
    background: 'color-background',
    minimum: 4.5,
    label: 'info status text on the app background',
  },
  {
    foreground: 'color-success',
    background: 'color-surface',
    minimum: 4.5,
    label: 'success status text on elevated surfaces',
  },
  {
    foreground: 'color-error',
    background: 'color-surface',
    minimum: 4.5,
    label: 'error status text on elevated surfaces',
  },
  {
    foreground: 'color-warning',
    background: 'color-surface',
    minimum: 4.5,
    label: 'warning status text on elevated surfaces',
  },
  {
    foreground: 'color-info',
    background: 'color-surface',
    minimum: 4.5,
    label: 'info status text on elevated surfaces',
  },
] as const;

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
