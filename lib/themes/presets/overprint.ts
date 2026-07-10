import { defineTheme } from '../schema';

/**
 * Overprint Theme — Two-Ink Risograph Poster
 *
 * Design philosophy:
 * - Riso-red and riso-blue printed on cream stock, one ink slightly off-register
 * - Native mode: light (the printed poster)
 * - Dark mode: the blue plate lit from behind
 *
 * Motion: Snappy (150ms default)
 * Spacing: kenya-standard
 * Typography: 1.333 ratio (Perfect Fourth) — punchy poster scale
 */
export const overprintTheme = defineTheme({
  id: 'overprint',
  label: 'Overprint',
  description: 'Two-ink risograph poster',
  tokens: {
    light: {
      // Colors — cream stock, riso red + riso blue ink
      'color-primary': '#c41f30',
      'color-primary-hover': '#a91929',
      'color-primary-active': '#8f1522',
      'color-background': '#f6f2e8',
      'color-foreground': '#1d3557',
      'color-surface': '#fffdf6',
      'color-surface-hover': '#efe9da',
      'color-muted': '#efe9da',
      'color-border': '#d8cfba',
      'color-border-subtle': '#eae4d3',
      'color-text-primary': '#1d3557',
      'color-text-secondary': '#3f5680',
      'color-text-muted': '#7a88a3',
      'color-text-inverse': '#fffdf6',
      'color-focus-ring': '#1d3557',
      'color-success': '#2f7d4f',
      'color-error': '#c41f30',
      'color-warning': '#b9791b',
      'color-info': '#1d3557',

      // Fonts
      'font-display': 'var(--font-archivo-black)',
      'font-sans': 'var(--font-archivo)',
      'font-mono': 'var(--font-space-mono)',

      // Typography — 1.333 ratio (Perfect Fourth), punchy poster scale
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
      'leading-tight': '1.0',
      'leading-normal': '1.35',
      'leading-relaxed': '1.55',
      'tracking-tighter': '-0.04em',
      'tracking-tight': '-0.02em',
      'tracking-normal': '0',
      'tracking-wide': '0.04em',
      'tracking-wider': '0.08em',

      // Shadows — flat offset, second-ink (riso blue) tint
      'shadow-sm': '2px 2px 0px rgba(29, 53, 87, 0.35)',
      'shadow-md': '3px 3px 0px rgba(29, 53, 87, 0.3)',
      'shadow-lg': '5px 5px 0px rgba(29, 53, 87, 0.28)',
      'shadow-color': '29 53 87',

      // Radius — near-zero, print-plate square
      'radius-sm': '1px',
      'radius-md': '2px',
      'radius-lg': '2px',
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

      // Transitions — snappy
      'duration-instant': '50ms',
      'duration-fast': '100ms',
      'duration-normal': '150ms',
      'duration-slow': '260ms',
      'ease-theme': 'cubic-bezier(0.2, 0.8, 0.3, 1)',
      'ease-in': 'cubic-bezier(0.4, 0, 0.6, 1)',
      'ease-out': 'cubic-bezier(0.15, 1, 0.3, 1)',
    },
    dark: {
      // Colors — the blue plate, lifted red-pink ink
      'color-primary': '#ff5964',
      'color-primary-hover': '#ff727b',
      'color-primary-active': '#e6414c',
      'color-background': '#141d2e',
      'color-foreground': '#e8eefb',
      'color-surface': '#1d2a40',
      'color-surface-hover': '#26374f',
      'color-muted': '#1d2a40',
      'color-border': '#334862',
      'color-border-subtle': '#1d2a40',
      'color-text-primary': '#e8eefb',
      'color-text-secondary': '#a9bcdd',
      'color-text-muted': '#7488ac',
      'color-text-inverse': '#2a0508',
      'color-focus-ring': '#ff5964',
      'color-success': '#5cbd84',
      'color-error': '#ff5964',
      'color-warning': '#e0a94a',
      'color-info': '#7ba7e8',

      // Fonts
      'font-display': 'var(--font-archivo-black)',
      'font-sans': 'var(--font-archivo)',
      'font-mono': 'var(--font-space-mono)',

      // Typography
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
      'leading-tight': '1.0',
      'leading-normal': '1.35',
      'leading-relaxed': '1.55',
      'tracking-tighter': '-0.04em',
      'tracking-tight': '-0.02em',
      'tracking-normal': '0',
      'tracking-wide': '0.04em',
      'tracking-wider': '0.08em',

      // Shadows — flat offset, second-ink (riso red) tint
      'shadow-sm': '2px 2px 0px rgba(255, 89, 100, 0.3)',
      'shadow-md': '3px 3px 0px rgba(255, 89, 100, 0.25)',
      'shadow-lg': '5px 5px 0px rgba(255, 89, 100, 0.22)',
      'shadow-color': '255 89 100',

      // Radius
      'radius-sm': '1px',
      'radius-md': '2px',
      'radius-lg': '2px',
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
      'duration-instant': '50ms',
      'duration-fast': '100ms',
      'duration-normal': '150ms',
      'duration-slow': '260ms',
      'ease-theme': 'cubic-bezier(0.2, 0.8, 0.3, 1)',
      'ease-in': 'cubic-bezier(0.4, 0, 0.6, 1)',
      'ease-out': 'cubic-bezier(0.15, 1, 0.3, 1)',
    },
  },
});
