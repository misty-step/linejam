import { defineTheme } from '../schema';

/**
 * Kenya Theme — Japanese Editorial Minimalism
 *
 * Design philosophy:
 * - Ma (間): The space between
 * - Ink on Rice Paper: Warm neutrals, organic texture
 * - Persimmon Stamp: One strong accent, confident restraint
 *
 * Motion: Deliberate, mechanical (250ms default)
 * Spacing: Generous (1x base)
 * Typography: 1.333 ratio (Perfect Fourth)
 */
export const kenyaTheme = defineTheme({
  id: 'kenya',
  label: 'Kenya',
  description: 'Japanese editorial minimalism',
  tokens: {
    light: {
      // Colors
      'color-primary': '#e85d2b',
      'color-primary-hover': '#c44521',
      'color-primary-active': '#a8391a',
      'color-background': '#faf9f7',
      'color-foreground': '#1c1917',
      'color-surface': '#ffffff',
      'color-surface-hover': '#f5f5f4',
      'color-muted': '#f5f5f4',
      'color-border': '#e7e5e4',
      'color-border-subtle': '#f5f5f4',
      'color-text-primary': '#1c1917',
      'color-text-secondary': '#57534e',
      'color-text-muted': '#a8a29e',
      'color-text-inverse': '#faf9f7',
      'color-focus-ring': '#e85d2b',
      'color-success': '#10b981',
      'color-error': '#ef4444',
      'color-warning': '#f59e0b',
      'color-info': '#0ea5e9',

      // Fonts
      'font-display': 'var(--font-libre-baskerville)',
      'font-sans': 'var(--font-ibm-plex)',
      'font-mono': 'var(--font-jetbrains-mono)',

      // Typography - 1.333 ratio (Perfect Fourth)
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
      'leading-tight': '1.1',
      'leading-normal': '1.5',
      'leading-relaxed': '1.75',
      'tracking-tighter': '-0.05em',
      'tracking-tight': '-0.025em',
      'tracking-normal': '0',
      'tracking-wide': '0.025em',
      'tracking-wider': '0.05em',

      // Shadows - Hard offset with persimmon tint
      'shadow-sm': '2px 2px 0px rgba(232, 93, 43, 0.15)',
      'shadow-md': '4px 4px 0px rgba(232, 93, 43, 0.1)',
      'shadow-lg': '8px 8px 0px rgba(232, 93, 43, 0.12)',
      'shadow-color': '232 93 43',

      // Radius - Subtle softness
      'radius-sm': '3px',
      'radius-md': '4px',
      'radius-lg': '6px',
      'radius-full': '9999px',

      // Spacing - 1x base (generous)
      'space-1': '0.25rem',
      'space-2': '0.5rem',
      'space-3': '1rem',
      'space-4': '1.5rem',
      'space-5': '2.5rem',
      'space-6': '4rem',
      'space-7': '6rem',
      'space-8': '9rem',

      // Transitions - Deliberate, mechanical
      'duration-instant': '75ms',
      'duration-fast': '150ms',
      'duration-normal': '250ms',
      'duration-slow': '400ms',
      'ease-theme': 'cubic-bezier(0.25, 1, 0.5, 1)',
      'ease-in': 'cubic-bezier(0.25, 0.1, 0.25, 1)',
      'ease-out': 'cubic-bezier(0.25, 1, 0.5, 1)',
    },
    dark: {
      // Colors
      'color-primary': '#e85d2b',
      'color-primary-hover': '#f06b3b',
      'color-primary-active': '#d54a1f',
      'color-background': '#1c1917',
      'color-foreground': '#faf9f7',
      'color-surface': '#292524',
      'color-surface-hover': '#3f3f46',
      'color-muted': '#292524',
      'color-border': '#44403c',
      'color-border-subtle': '#292524',
      'color-text-primary': '#faf9f7',
      'color-text-secondary': '#d6d3d1',
      'color-text-muted': '#a8a29e',
      'color-text-inverse': '#1c1917',
      'color-focus-ring': '#e85d2b',
      'color-success': '#10b981',
      'color-error': '#ef4444',
      'color-warning': '#f59e0b',
      'color-info': '#0ea5e9',

      // Fonts
      'font-display': 'var(--font-libre-baskerville)',
      'font-sans': 'var(--font-ibm-plex)',
      'font-mono': 'var(--font-jetbrains-mono)',

      // Typography - 1.333 ratio (Perfect Fourth)
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
      'leading-tight': '1.1',
      'leading-normal': '1.5',
      'leading-relaxed': '1.75',
      'tracking-tighter': '-0.05em',
      'tracking-tight': '-0.025em',
      'tracking-normal': '0',
      'tracking-wide': '0.025em',
      'tracking-wider': '0.05em',

      // Shadows - Hard offset with persimmon tint (slightly stronger in dark)
      'shadow-sm': '2px 2px 0px rgba(232, 93, 43, 0.2)',
      'shadow-md': '4px 4px 0px rgba(232, 93, 43, 0.15)',
      'shadow-lg': '8px 8px 0px rgba(232, 93, 43, 0.18)',
      'shadow-color': '232 93 43',

      // Radius
      'radius-sm': '3px',
      'radius-md': '4px',
      'radius-lg': '6px',
      'radius-full': '9999px',

      // Spacing
      'space-1': '0.25rem',
      'space-2': '0.5rem',
      'space-3': '1rem',
      'space-4': '1.5rem',
      'space-5': '2.5rem',
      'space-6': '4rem',
      'space-7': '6rem',
      'space-8': '9rem',

      // Transitions
      'duration-instant': '75ms',
      'duration-fast': '150ms',
      'duration-normal': '250ms',
      'duration-slow': '400ms',
      'ease-theme': 'cubic-bezier(0.25, 1, 0.5, 1)',
      'ease-in': 'cubic-bezier(0.25, 0.1, 0.25, 1)',
      'ease-out': 'cubic-bezier(0.25, 1, 0.5, 1)',
    },
  },
});
