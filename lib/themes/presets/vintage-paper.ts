import { defineTheme } from '../schema';

/**
 * Vintage Paper Theme — Aged Literary Warmth
 *
 * Design philosophy:
 * - Sepia-tinted neutrals
 * - Aged paper background
 * - Muted burgundy accent
 * - Soft blur shadows
 * - Rounded, friendly corners
 * - Slow, organic transitions with spring bounce
 *
 * Motion: Leisurely (500ms default)
 * Spacing: Luxurious (1.25x base)
 * Typography: 1.333 ratio (Perfect Fourth) - balanced, literary
 */
export const vintagePaperTheme = defineTheme({
  id: 'vintage-paper',
  label: 'Vintage Paper',
  description: 'Aged literary warmth',
  tokens: {
    light: {
      // Colors - Sepia tints with burgundy accent
      'color-primary': '#8b3a3a',
      'color-primary-hover': '#722e2e',
      'color-primary-active': '#5c2424',
      'color-background': '#f5efe6',
      'color-foreground': '#3d3632',
      'color-surface': '#fffdf8',
      'color-surface-hover': '#f0ebe2',
      'color-muted': '#ebe5da',
      'color-border': '#d4cdc2',
      'color-border-subtle': '#e8e2d8',
      'color-text-primary': '#3d3632',
      'color-text-secondary': '#5c5650',
      'color-text-muted': '#8a837a',
      'color-text-inverse': '#fffdf8',
      'color-focus-ring': '#8b3a3a',
      'color-success': '#5a7a5a',
      'color-error': '#9a4a4a',
      'color-warning': '#8a6a3a',
      'color-info': '#4a6a8a',

      // Fonts
      'font-display': 'var(--font-cormorant)',
      'font-sans': 'var(--font-source-serif)',
      'font-mono': 'var(--font-jetbrains-mono)',

      // Typography - 1.333 ratio (Perfect Fourth) - balanced, literary
      'text-xs': '0.75rem',
      'text-sm': '0.875rem',
      'text-base': '1rem',
      'text-md': '1.125rem',
      'text-lg': '1.333rem',
      'text-xl': '1.777rem',
      'text-2xl': '2.369rem',
      'text-3xl': '3.157rem',
      'text-4xl': '4.209rem',
      'text-5xl': '5.61rem',
      'leading-tight': '1.2',
      'leading-normal': '1.6',
      'leading-relaxed': '1.9',
      'tracking-tighter': '-0.02em',
      'tracking-tight': '-0.01em',
      'tracking-normal': '0.01em',
      'tracking-wide': '0.08em',
      'tracking-wider': '0.15em',

      // Shadows - Soft blur with warm brown tint
      'shadow-sm': '0 1px 3px rgba(61, 54, 50, 0.08)',
      'shadow-md': '0 4px 6px rgba(61, 54, 50, 0.06)',
      'shadow-lg': '0 10px 20px rgba(61, 54, 50, 0.08)',
      'shadow-color': '61 54 50',

      // Radius - Rounded, friendly
      'radius-sm': '6px',
      'radius-md': '8px',
      'radius-lg': '12px',
      'radius-full': '9999px',

      // Spacing - 1.25x base (luxurious)
      'space-1': '0.375rem',
      'space-2': '0.75rem',
      'space-3': '1.25rem',
      'space-4': '2rem',
      'space-5': '3rem',
      'space-6': '4.5rem',
      'space-7': '7rem',
      'space-8': '10rem',

      // Transitions - Leisurely with organic spring
      'duration-instant': '150ms',
      'duration-fast': '300ms',
      'duration-normal': '500ms',
      'duration-slow': '800ms',
      'ease-theme': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      'ease-in': 'cubic-bezier(0.16, 1, 0.3, 1)',
      'ease-out': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    },
    dark: {
      // Colors - Warm dark with lighter burgundy
      'color-primary': '#c76b6b',
      'color-primary-hover': '#d47a7a',
      'color-primary-active': '#b85c5c',
      'color-background': '#2a2521',
      'color-foreground': '#e8e2d8',
      'color-surface': '#352f2a',
      'color-surface-hover': '#403834',
      'color-muted': '#352f2a',
      'color-border': '#504840',
      'color-border-subtle': '#403834',
      'color-text-primary': '#e8e2d8',
      'color-text-secondary': '#c4bdb4',
      'color-text-muted': '#8a837a',
      'color-text-inverse': '#2a2521',
      'color-focus-ring': '#c76b6b',
      'color-success': '#7a9a7a',
      'color-error': '#ba6a6a',
      'color-warning': '#aa8a5a',
      'color-info': '#6a8aaa',

      // Fonts
      'font-display': 'var(--font-cormorant)',
      'font-sans': 'var(--font-source-serif)',
      'font-mono': 'var(--font-jetbrains-mono)',

      // Typography - 1.333 ratio (Perfect Fourth) - balanced, literary
      'text-xs': '0.75rem',
      'text-sm': '0.875rem',
      'text-base': '1rem',
      'text-md': '1.125rem',
      'text-lg': '1.333rem',
      'text-xl': '1.777rem',
      'text-2xl': '2.369rem',
      'text-3xl': '3.157rem',
      'text-4xl': '4.209rem',
      'text-5xl': '5.61rem',
      'leading-tight': '1.2',
      'leading-normal': '1.6',
      'leading-relaxed': '1.9',
      'tracking-tighter': '-0.02em',
      'tracking-tight': '-0.01em',
      'tracking-normal': '0.01em',
      'tracking-wide': '0.08em',
      'tracking-wider': '0.15em',

      // Shadows - Softer in dark mode
      'shadow-sm': '0 1px 3px rgba(0, 0, 0, 0.2)',
      'shadow-md': '0 4px 6px rgba(0, 0, 0, 0.15)',
      'shadow-lg': '0 10px 20px rgba(0, 0, 0, 0.2)',
      'shadow-color': '0 0 0',

      // Radius
      'radius-sm': '6px',
      'radius-md': '8px',
      'radius-lg': '12px',
      'radius-full': '9999px',

      // Spacing
      'space-1': '0.375rem',
      'space-2': '0.75rem',
      'space-3': '1.25rem',
      'space-4': '2rem',
      'space-5': '3rem',
      'space-6': '4.5rem',
      'space-7': '7rem',
      'space-8': '10rem',

      // Transitions
      'duration-instant': '150ms',
      'duration-fast': '300ms',
      'duration-normal': '500ms',
      'duration-slow': '800ms',
      'ease-theme': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      'ease-in': 'cubic-bezier(0.16, 1, 0.3, 1)',
      'ease-out': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    },
  },
});
