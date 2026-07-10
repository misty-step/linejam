import { defineTheme } from '../schema';

/**
 * Catalog Theme — Poem Catalog, Edition Cards
 *
 * Design philosophy:
 * - A leaf-green library catalog card: crisp, tidy, thin rules
 * - Native mode: light (the reading room)
 * - Dark mode: the same card scanned under a green-shaded lamp
 *
 * Motion: Neat, quick (150ms default)
 * Spacing: kenya-standard
 * Typography: 1.25 ratio (Major Third) — tidy, systematic
 */
export const catalogTheme = defineTheme({
  id: 'catalog',
  label: 'Poem Catalog',
  description: 'Edition cards, leaf green',
  tokens: {
    light: {
      // Colors — reading-room paper, leaf green
      'color-primary': '#2f7d4f',
      'color-primary-hover': '#266641',
      'color-primary-active': '#1f5636',
      'color-background': '#fbfaf3',
      'color-foreground': '#1d2b1f',
      'color-surface': '#ffffff',
      'color-surface-hover': '#eef0e5',
      'color-muted': '#eef0e5',
      'color-border': '#d5dccb',
      'color-border-subtle': '#e7ebdd',
      'color-text-primary': '#1d2b1f',
      'color-text-secondary': '#3f5645',
      'color-text-muted': '#788a7c',
      'color-text-inverse': '#fbfaf3',
      'color-focus-ring': '#2f7d4f',
      'color-success': '#2f7d4f',
      'color-error': '#b1372a',
      'color-warning': '#a37a1e',
      'color-info': '#2e6b7a',

      // Fonts
      'font-display': 'var(--font-fraunces)',
      'font-sans': 'var(--font-outfit)',
      'font-mono': 'var(--font-jetbrains-mono)',

      // Typography — 1.25 ratio (Major Third), tidy
      'text-xs': '0.75rem',
      'text-sm': '0.875rem',
      'text-base': '1rem',
      'text-md': '1.125rem',
      'text-lg': '1.25rem',
      'text-xl': '1.563rem',
      'text-2xl': '1.953rem',
      'text-3xl': '2.441rem',
      'text-4xl': '3.052rem',
      'text-5xl': '3.815rem',
      'leading-tight': '1.15',
      'leading-normal': '1.45',
      'leading-relaxed': '1.65',
      'tracking-tighter': '-0.02em',
      'tracking-tight': '-0.01em',
      'tracking-normal': '0',
      'tracking-wide': '0.03em',
      'tracking-wider': '0.06em',

      // Shadows — thin, crisp, barely there
      'shadow-sm': '0px 1px 1px rgba(29, 43, 31, 0.06)',
      'shadow-md': '0px 2px 4px rgba(29, 43, 31, 0.08)',
      'shadow-lg': '0px 4px 10px rgba(29, 43, 31, 0.1)',
      'shadow-color': '29 43 31',

      // Radius — crisp, small
      'radius-sm': '2px',
      'radius-md': '3px',
      'radius-lg': '4px',
      'radius-full': '9999px',

      // Spacing — kenya-standard
      'space-1': '0.25rem',
      'space-2': '0.5rem',
      'space-3': '1rem',
      'space-4': '1.5rem',
      'space-5': '2.5rem',
      'space-6': '4rem',
      'space-7': '6rem',
      'space-8': '9rem',

      // Transitions — neat, quick
      'duration-instant': '50ms',
      'duration-fast': '110ms',
      'duration-normal': '180ms',
      'duration-slow': '300ms',
      'ease-theme': 'cubic-bezier(0.3, 0.9, 0.4, 1)',
      'ease-in': 'cubic-bezier(0.4, 0, 0.6, 1)',
      'ease-out': 'cubic-bezier(0.2, 1, 0.4, 1)',
    },
    dark: {
      // Colors — green-shaded lamp, lifted leaf
      'color-primary': '#5cbd84',
      'color-primary-hover': '#6fcb93',
      'color-primary-active': '#4aa871',
      'color-background': '#131c16',
      'color-foreground': '#e7f0e9',
      'color-surface': '#1c2a20',
      'color-surface-hover': '#25352a',
      'color-muted': '#1c2a20',
      'color-border': '#33452f',
      'color-border-subtle': '#1c2a20',
      'color-text-primary': '#e7f0e9',
      'color-text-secondary': '#b7c9bc',
      'color-text-muted': '#83947e',
      'color-text-inverse': '#0a1a10',
      'color-focus-ring': '#5cbd84',
      'color-success': '#5cbd84',
      'color-error': '#e08672',
      'color-warning': '#d1ab5a',
      'color-info': '#6fb4c4',

      // Fonts
      'font-display': 'var(--font-fraunces)',
      'font-sans': 'var(--font-outfit)',
      'font-mono': 'var(--font-jetbrains-mono)',

      // Typography
      'text-xs': '0.75rem',
      'text-sm': '0.875rem',
      'text-base': '1rem',
      'text-md': '1.125rem',
      'text-lg': '1.25rem',
      'text-xl': '1.563rem',
      'text-2xl': '1.953rem',
      'text-3xl': '2.441rem',
      'text-4xl': '3.052rem',
      'text-5xl': '3.815rem',
      'leading-tight': '1.15',
      'leading-normal': '1.45',
      'leading-relaxed': '1.65',
      'tracking-tighter': '-0.02em',
      'tracking-tight': '-0.01em',
      'tracking-normal': '0',
      'tracking-wide': '0.03em',
      'tracking-wider': '0.06em',

      // Shadows
      'shadow-sm': '0px 1px 1px rgba(0, 0, 0, 0.3)',
      'shadow-md': '0px 2px 4px rgba(0, 0, 0, 0.35)',
      'shadow-lg': '0px 4px 10px rgba(0, 0, 0, 0.4)',
      'shadow-color': '0 0 0',

      // Radius
      'radius-sm': '2px',
      'radius-md': '3px',
      'radius-lg': '4px',
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
      'duration-fast': '110ms',
      'duration-normal': '180ms',
      'duration-slow': '300ms',
      'ease-theme': 'cubic-bezier(0.3, 0.9, 0.4, 1)',
      'ease-in': 'cubic-bezier(0.4, 0, 0.6, 1)',
      'ease-out': 'cubic-bezier(0.2, 1, 0.4, 1)',
    },
  },
});
