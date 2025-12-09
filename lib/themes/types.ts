/**
 * Theme System Type Definitions
 *
 * Flat token structure where keys map directly to CSS variable names.
 * No nested objects = no manual mapping in apply.ts.
 */

export type ThemeMode = 'light' | 'dark';

/**
 * Flat token interface - keys ARE CSS variable names (without --)
 *
 * @example
 * 'color-primary' -> --color-primary
 * 'text-xl' -> --text-xl
 */
export interface ThemeTokens {
  // ═══════════════════════════════════════════════════════════════════════════
  // Colors (15 required + 4 optional)
  // ═══════════════════════════════════════════════════════════════════════════
  'color-primary': string;
  'color-primary-hover': string;
  'color-primary-active': string;
  'color-background': string;
  'color-foreground': string;
  'color-surface': string;
  'color-surface-hover': string;
  'color-muted': string;
  'color-border': string;
  'color-border-subtle': string;
  'color-text-primary': string;
  'color-text-secondary': string;
  'color-text-muted': string;
  'color-text-inverse': string;
  'color-focus-ring': string;
  // Optional semantic colors
  'color-success'?: string;
  'color-error'?: string;
  'color-warning'?: string;
  'color-info'?: string;

  // ═══════════════════════════════════════════════════════════════════════════
  // Fonts (3)
  // ═══════════════════════════════════════════════════════════════════════════
  'font-display': string;
  'font-sans': string;
  'font-mono': string;

  // ═══════════════════════════════════════════════════════════════════════════
  // Typography (18)
  // ═══════════════════════════════════════════════════════════════════════════
  // Font sizes
  'text-xs': string;
  'text-sm': string;
  'text-base': string;
  'text-md': string;
  'text-lg': string;
  'text-xl': string;
  'text-2xl': string;
  'text-3xl': string;
  'text-4xl': string;
  'text-5xl': string;
  // Line heights
  'leading-tight': string;
  'leading-normal': string;
  'leading-relaxed': string;
  // Letter spacing
  'tracking-tighter': string;
  'tracking-tight': string;
  'tracking-normal': string;
  'tracking-wide': string;
  'tracking-wider': string;

  // ═══════════════════════════════════════════════════════════════════════════
  // Shadows (4)
  // ═══════════════════════════════════════════════════════════════════════════
  'shadow-sm': string;
  'shadow-md': string;
  'shadow-lg': string;
  'shadow-color': string; // RGB values for rgba() composition

  // ═══════════════════════════════════════════════════════════════════════════
  // Radius (4)
  // ═══════════════════════════════════════════════════════════════════════════
  'radius-sm': string;
  'radius-md': string;
  'radius-lg': string;
  'radius-full': string;

  // ═══════════════════════════════════════════════════════════════════════════
  // Spacing (8)
  // ═══════════════════════════════════════════════════════════════════════════
  'space-1': string;
  'space-2': string;
  'space-3': string;
  'space-4': string;
  'space-5': string;
  'space-6': string;
  'space-7': string;
  'space-8': string;

  // ═══════════════════════════════════════════════════════════════════════════
  // Transitions (7)
  // ═══════════════════════════════════════════════════════════════════════════
  'duration-instant': string;
  'duration-fast': string;
  'duration-normal': string;
  'duration-slow': string;
  'ease-theme': string;
  'ease-in': string;
  'ease-out': string;
}

/**
 * Complete theme preset definition
 */
export interface ThemePreset {
  /** Unique identifier (used in localStorage, data-theme attribute) */
  id: string;
  /** Display name for UI */
  label: string;
  /** Short description for theme picker */
  description: string;
  /** Token definitions for light and dark modes */
  tokens: {
    light: ThemeTokens;
    dark: ThemeTokens;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Legacy type aliases (for gradual migration)
// ═══════════════════════════════════════════════════════════════════════════

/** @deprecated Use ThemeTokens directly */
export type ThemeStyleProps = ThemeTokens;

/** @deprecated Theme IDs are now strings, validated at runtime */
export type ThemeId = string;
