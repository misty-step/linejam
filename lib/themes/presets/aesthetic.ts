import { defineTheme } from '../schema';
import type { ThemeTokens } from '../types';

/**
 * Aesthetic — the misty-step substrate (default theme)
 *
 * Every token points at the @misty-step/aesthetic custom properties
 * (--ae-*), so this "theme" adds nothing of its own: it IS the design
 * system. Light and dark are identical maps — aesthetic.css resolves
 * the --ae-* values from the .light/.dark class the theme system
 * already pins on <html>.
 *
 * The law (see the aesthetic package header):
 * - One font size; hierarchy from ink and weight (400/550/800).
 * - Hairlines and radius 0. No decorative shadows.
 * - Status rides the glyph, never a filled pill.
 * - Motion is feedback that resolves once; nothing ambient.
 *
 * The persimmon accent is steered once in globals.css
 * (--ae-accent / --ae-accent-dark), not here.
 */
export const substrateTokens: ThemeTokens = {
  // Colors — straight to the substrate
  'color-primary': 'var(--ae-accent)',
  'color-primary-hover': 'var(--ae-accent)',
  'color-primary-active': 'var(--ae-accent)',
  'color-background': 'var(--ae-surface)',
  'color-foreground': 'var(--ae-ink)',
  'color-surface': 'var(--ae-surface)',
  'color-surface-hover': 'var(--ae-wash)',
  'color-muted': 'var(--ae-wash)',
  'color-border': 'var(--ae-line)',
  'color-border-subtle': 'var(--ae-line)',
  'color-text-primary': 'var(--ae-ink)',
  'color-text-secondary': 'var(--ae-ink-muted)',
  'color-text-muted': 'var(--ae-ink-faint)',
  'color-text-inverse': 'var(--ae-surface)',
  'color-focus-ring': 'var(--ae-ink)',
  'color-success': 'var(--ae-ok)',
  'color-error': 'var(--ae-err)',
  'color-warning': 'var(--ae-warn)',
  'color-info': 'var(--ae-accent)',

  // Fonts — Geist carries everything; mono is the caption voice
  'font-display': 'var(--ae-font)',
  'font-sans': 'var(--ae-font)',
  'font-mono': 'var(--ae-font-mono)',

  // Typography — the scale collapses: one size (16px) plus the 13px
  // chrome register. Hierarchy comes from ink and weight, never scale.
  'text-xs': '0.8125rem',
  'text-sm': '0.8125rem',
  'text-base': '1rem',
  'text-md': '1rem',
  'text-lg': '1rem',
  'text-xl': '1rem',
  'text-2xl': '1rem',
  'text-3xl': '1rem',
  'text-4xl': '1rem',
  'text-5xl': '1rem',
  'leading-tight': '1.8',
  'leading-normal': '1.8',
  'leading-relaxed': '1.8',
  'tracking-tighter': '0',
  'tracking-tight': '0',
  'tracking-normal': '0',
  'tracking-wide': '0.08em',
  'tracking-wider': '0.14em',

  // Shadows — hairlines structure the page, not depth
  'shadow-sm': 'none',
  'shadow-md': 'none',
  'shadow-lg': 'none',
  'shadow-color': '0 0 0',

  // Radius — 0 everywhere; even "full" marks become ink squares
  'radius-sm': '0px',
  'radius-md': '0px',
  'radius-lg': '0px',
  'radius-full': '0px',

  // Spacing — density is a dial; keep the generous editorial rhythm
  'space-1': '0.25rem',
  'space-2': '0.5rem',
  'space-3': '1rem',
  'space-4': '1.5rem',
  'space-5': '2.5rem',
  'space-6': '4rem',
  'space-7': '6rem',
  'space-8': '9rem',

  // Motion — feedback only: quick, soft, gentle
  'duration-instant': '80ms',
  'duration-fast': 'var(--ae-quick)',
  'duration-normal': 'var(--ae-soft)',
  'duration-slow': 'var(--ae-gentle)',
  'ease-theme': 'var(--ae-ease)',
  'ease-in': 'var(--ae-ease)',
  'ease-out': 'var(--ae-ease)',
};

export const aestheticTheme = defineTheme({
  id: 'aesthetic',
  label: 'Aesthetic',
  description: 'Ink on paper — the misty-step substrate',
  tokens: {
    light: substrateTokens,
    dark: substrateTokens,
  },
});
