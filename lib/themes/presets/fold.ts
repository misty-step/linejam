import { defineTheme } from '../schema';

/**
 * Fold Theme — Folded Manuscript, Quiet Ink
 *
 * Design philosophy:
 * - Manuscript paper and burnt-sienna ink
 * - Native mode: light (paper under daylight)
 * - Dark mode: the same page read by lamplight
 *
 * Motion: Unhurried (250ms default)
 * Spacing: Generous, kenya-standard
 * Typography: 1.25 ratio (Major Third) — calm, book-like
 */
export const foldTheme = defineTheme({
  id: 'fold',
  label: 'The Fold',
  description: 'Folded manuscript, quiet ink',
  tokens: {
    light: {
      // Colors — manuscript paper, burnt sienna ink
      'color-primary': '#a34a26',
      'color-primary-hover': '#8a3d1f',
      'color-primary-active': '#72331a',
      'color-background': '#f4efe6',
      'color-foreground': '#232019',
      'color-surface': '#fbf8f1',
      'color-surface-hover': '#efe8db',
      'color-muted': '#efe8db',
      'color-border': '#ddd3c1',
      'color-border-subtle': '#eae2d3',
      'color-text-primary': '#232019',
      'color-text-secondary': '#5a4f42',
      'color-text-muted': '#8c8171',
      'color-text-inverse': '#fbf3ea',
      'color-focus-ring': '#a34a26',
      'color-success': '#4a7c4e',
      'color-error': '#a8382a',
      'color-warning': '#a3781f',
      'color-info': '#3d6a7d',

      // Fonts
      'font-display': 'var(--font-fraunces)',
      'font-sans': 'var(--font-source-serif)',
      'font-mono': 'var(--font-jetbrains-mono)',

      // Typography — 1.25 ratio (Major Third), calm and unhurried
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
      'leading-tight': '1.2',
      'leading-normal': '1.6',
      'leading-relaxed': '1.85',
      'tracking-tighter': '-0.03em',
      'tracking-tight': '-0.015em',
      'tracking-normal': '0',
      'tracking-wide': '0.02em',
      'tracking-wider': '0.04em',

      // Shadows — feathered, low, sienna-tinted
      'shadow-sm': '0px 1px 2px rgba(163, 74, 38, 0.08)',
      'shadow-md': '0px 2px 6px rgba(163, 74, 38, 0.1)',
      'shadow-lg': '0px 4px 14px rgba(163, 74, 38, 0.12)',
      'shadow-color': '163 74 38',

      // Radius — soft, book-bound
      'radius-sm': '4px',
      'radius-md': '6px',
      'radius-lg': '8px',
      'radius-full': '9999px',

      // Spacing — generous, kenya-standard
      'space-1': '0.25rem',
      'space-2': '0.5rem',
      'space-3': '1rem',
      'space-4': '1.5rem',
      'space-5': '2.5rem',
      'space-6': '4rem',
      'space-7': '6rem',
      'space-8': '9rem',

      // Transitions — unhurried
      'duration-instant': '100ms',
      'duration-fast': '175ms',
      'duration-normal': '250ms',
      'duration-slow': '420ms',
      'ease-theme': 'cubic-bezier(0.25, 1, 0.5, 1)',
      'ease-in': 'cubic-bezier(0.3, 0, 0.4, 1)',
      'ease-out': 'cubic-bezier(0.2, 1, 0.4, 1)',
    },
    dark: {
      // Colors — lamplit desk, lifted sienna
      'color-primary': '#d67244',
      'color-primary-hover': '#e18657',
      'color-primary-active': '#c05f34',
      'color-background': '#221e17',
      'color-foreground': '#f3ede4',
      'color-surface': '#2c2820',
      'color-surface-hover': '#38332a',
      'color-muted': '#2c2820',
      'color-border': '#443d31',
      'color-border-subtle': '#2c2820',
      'color-text-primary': '#f3ede4',
      'color-text-secondary': '#c9bfae',
      'color-text-muted': '#948a79',
      'color-text-inverse': '#241206',
      'color-focus-ring': '#d67244',
      'color-success': '#7cb480',
      'color-error': '#d47262',
      'color-warning': '#d1a24a',
      'color-info': '#7ba7b8',

      // Fonts
      'font-display': 'var(--font-fraunces)',
      'font-sans': 'var(--font-source-serif)',
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
      'leading-tight': '1.2',
      'leading-normal': '1.6',
      'leading-relaxed': '1.85',
      'tracking-tighter': '-0.03em',
      'tracking-tight': '-0.015em',
      'tracking-normal': '0',
      'tracking-wide': '0.02em',
      'tracking-wider': '0.04em',

      // Shadows — feathered, low, deeper in lamplight
      'shadow-sm': '0px 1px 2px rgba(0, 0, 0, 0.3)',
      'shadow-md': '0px 2px 6px rgba(0, 0, 0, 0.35)',
      'shadow-lg': '0px 4px 14px rgba(0, 0, 0, 0.4)',
      'shadow-color': '0 0 0',

      // Radius
      'radius-sm': '4px',
      'radius-md': '6px',
      'radius-lg': '8px',
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
      'duration-instant': '100ms',
      'duration-fast': '175ms',
      'duration-normal': '250ms',
      'duration-slow': '420ms',
      'ease-theme': 'cubic-bezier(0.25, 1, 0.5, 1)',
      'ease-in': 'cubic-bezier(0.3, 0, 0.4, 1)',
      'ease-out': 'cubic-bezier(0.2, 1, 0.4, 1)',
    },
  },
});
