/**
 * Theme System Type Definitions
 *
 * Single source of truth for theme shape. All theme presets
 * and runtime code reference these types.
 */

// Theme identifiers
export type ThemeId = 'kenya' | 'mono' | 'vintage-paper';
export type ThemeMode = 'light' | 'dark';

// Color palette for a single mode
export interface ThemeColors {
  primary: string;
  primaryHover: string;
  primaryActive: string;
  background: string;
  foreground: string;
  surface: string;
  surfaceHover: string;
  muted: string;
  border: string;
  borderSubtle: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  focusRing: string;
  success?: string;
  error?: string;
  warning?: string;
  info?: string;
}

// Font references (CSS variable names set by next/font)
export interface ThemeFonts {
  display: string; // e.g., 'var(--font-libre-baskerville)'
  sans: string; // e.g., 'var(--font-ibm-plex)'
  mono: string; // e.g., 'var(--font-jetbrains-mono)'
}

// Shadow definitions
export interface ThemeShadows {
  sm: string;
  md: string;
  lg: string;
  color?: string; // RGB values for rgba() composition
}

// Border radius definitions
export interface ThemeRadius {
  sm: string;
  md: string;
  lg: string;
  full: string;
}

// Animation timing
export interface ThemeTransitions {
  instant: string;
  fast: string;
  normal: string;
  slow: string;
  easing: string; // Default easing for most transitions
  easingIn: string; // For entering elements
  easingOut: string; // For exiting elements
}

// Complete style props for one mode
export interface ThemeStyleProps {
  colors: ThemeColors;
  fonts: ThemeFonts;
  shadows: ThemeShadows;
  radius: ThemeRadius;
  transitions: ThemeTransitions;
}

// Complete theme preset
export interface ThemePreset {
  id: ThemeId;
  label: string;
  description: string;
  styles: {
    light: ThemeStyleProps;
    dark: ThemeStyleProps;
  };
}

// Theme registry (all presets)
export type ThemeRegistry = Record<ThemeId, ThemePreset>;
