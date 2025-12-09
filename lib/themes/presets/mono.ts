import { defineTheme } from '../schema';

/**
 * Mono Theme — Swiss Modernism
 *
 * Design philosophy:
 * - Pure black and white only
 * - No accent color — grayscale hierarchy
 * - No shadows, use borders for separation
 * - Zero radius (geometric purity)
 * - Instant, snappy transitions
 *
 * Motion: Instant (100ms default)
 * Spacing: Compact (0.75x base)
 * Typography: 1.25 ratio (Major Third)
 */
export const monoTheme = defineTheme({
  id: 'mono',
  label: 'Mono',
  description: 'Swiss modernism',
  tokens: {
    light: {
      // Colors - Pure black and white
      'color-primary': '#000000',
      'color-primary-hover': '#262626',
      'color-primary-active': '#404040',
      'color-background': '#ffffff',
      'color-foreground': '#000000',
      'color-surface': '#ffffff',
      'color-surface-hover': '#f5f5f5',
      'color-muted': '#f5f5f5',
      'color-border': '#000000',
      'color-border-subtle': '#e5e5e5',
      'color-text-primary': '#000000',
      'color-text-secondary': '#404040',
      'color-text-muted': '#737373',
      'color-text-inverse': '#ffffff',
      'color-focus-ring': '#000000',
      // No semantic colors - grayscale only

      // Fonts
      'font-display': 'var(--font-noto-serif)',
      'font-sans': 'var(--font-inter)',
      'font-mono': 'var(--font-jetbrains-mono)',

      // Typography - 1.25 ratio (Major Third) - compact, systematic
      'text-xs': '0.64rem',
      'text-sm': '0.8rem',
      'text-base': '1rem',
      'text-md': '1.125rem',
      'text-lg': '1.25rem',
      'text-xl': '1.563rem',
      'text-2xl': '1.953rem',
      'text-3xl': '2.441rem',
      'text-4xl': '3.052rem',
      'text-5xl': '3.815rem',
      'leading-tight': '1.0',
      'leading-normal': '1.3',
      'leading-relaxed': '1.5',
      'tracking-tighter': '-0.03em',
      'tracking-tight': '-0.015em',
      'tracking-normal': '0',
      'tracking-wide': '0.05em',
      'tracking-wider': '0.1em',

      // Shadows - None (Swiss modernism: use borders)
      'shadow-sm': 'none',
      'shadow-md': 'none',
      'shadow-lg': 'none',
      'shadow-color': '0 0 0',

      // Radius - Zero (geometric purity)
      'radius-sm': '0px',
      'radius-md': '0px',
      'radius-lg': '0px',
      'radius-full': '9999px',

      // Spacing - 0.75x base (compact)
      'space-1': '0.125rem',
      'space-2': '0.25rem',
      'space-3': '0.5rem',
      'space-4': '1rem',
      'space-5': '1.5rem',
      'space-6': '2rem',
      'space-7': '3rem',
      'space-8': '4rem',

      // Transitions - Instant feedback
      'duration-instant': '0ms',
      'duration-fast': '50ms',
      'duration-normal': '100ms',
      'duration-slow': '150ms',
      'ease-theme': 'cubic-bezier(0.4, 0, 1, 1)',
      'ease-in': 'cubic-bezier(0.4, 0, 1, 1)',
      'ease-out': 'cubic-bezier(0, 0, 0.2, 1)',
    },
    dark: {
      // Colors - Inverted black and white
      'color-primary': '#ffffff',
      'color-primary-hover': '#e5e5e5',
      'color-primary-active': '#d4d4d4',
      'color-background': '#000000',
      'color-foreground': '#ffffff',
      'color-surface': '#171717',
      'color-surface-hover': '#262626',
      'color-muted': '#171717',
      'color-border': '#ffffff',
      'color-border-subtle': '#262626',
      'color-text-primary': '#ffffff',
      'color-text-secondary': '#d4d4d4',
      'color-text-muted': '#737373',
      'color-text-inverse': '#000000',
      'color-focus-ring': '#ffffff',

      // Fonts
      'font-display': 'var(--font-noto-serif)',
      'font-sans': 'var(--font-inter)',
      'font-mono': 'var(--font-jetbrains-mono)',

      // Typography
      'text-xs': '0.64rem',
      'text-sm': '0.8rem',
      'text-base': '1rem',
      'text-md': '1.125rem',
      'text-lg': '1.25rem',
      'text-xl': '1.563rem',
      'text-2xl': '1.953rem',
      'text-3xl': '2.441rem',
      'text-4xl': '3.052rem',
      'text-5xl': '3.815rem',
      'leading-tight': '1.0',
      'leading-normal': '1.3',
      'leading-relaxed': '1.5',
      'tracking-tighter': '-0.03em',
      'tracking-tight': '-0.015em',
      'tracking-normal': '0',
      'tracking-wide': '0.05em',
      'tracking-wider': '0.1em',

      // Shadows - None
      'shadow-sm': 'none',
      'shadow-md': 'none',
      'shadow-lg': 'none',
      'shadow-color': '255 255 255',

      // Radius
      'radius-sm': '0px',
      'radius-md': '0px',
      'radius-lg': '0px',
      'radius-full': '9999px',

      // Spacing
      'space-1': '0.125rem',
      'space-2': '0.25rem',
      'space-3': '0.5rem',
      'space-4': '1rem',
      'space-5': '1.5rem',
      'space-6': '2rem',
      'space-7': '3rem',
      'space-8': '4rem',

      // Transitions
      'duration-instant': '0ms',
      'duration-fast': '50ms',
      'duration-normal': '100ms',
      'duration-slow': '150ms',
      'ease-theme': 'cubic-bezier(0.4, 0, 1, 1)',
      'ease-in': 'cubic-bezier(0.4, 0, 1, 1)',
      'ease-out': 'cubic-bezier(0, 0, 0.2, 1)',
    },
  },
});
