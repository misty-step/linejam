import { defineTheme } from '../schema';

/**
 * Hyper Theme — Digital Chaos & Brutalism
 *
 * Design philosophy:
 * - Rejection of negative space
 * - Embrace of saturation and contrast
 * - Glitch aesthetics and brutalist layouts
 * - Hard edges, thick borders, zero blur
 *
 * Colors:
 * - Light: White + Magenta (#FF00FF) + Cyan + Black
 * - Dark: Void (#050505) + Acid Green (#CCFF00) + Hot Pink + White
 *
 * Motion: Instant to fast, jerky (75ms default)
 * Spacing: Tight (0.8x base)
 * Typography: Geometric & Monospace mix
 */
export const hyperTheme = defineTheme({
  id: 'hyper',
  label: 'Hyper',
  description: 'Digital chaos & brutalism',
  tokens: {
    light: {
      // Colors - High contrast, neon on white
      'color-primary': '#ff00ff', // Magenta
      'color-primary-hover': '#cc00cc',
      'color-primary-active': '#990099',
      'color-background': '#ffffff',
      'color-foreground': '#000000',
      'color-surface': '#f0f0f0',
      'color-surface-hover': '#e0e0e0',
      'color-muted': '#e0e0e0',
      'color-border': '#000000',
      'color-border-subtle': '#cccccc',
      'color-text-primary': '#000000',
      'color-text-secondary': '#000000',
      'color-text-muted': '#666666',
      'color-text-inverse': '#ffffff',
      'color-focus-ring': '#00ffff', // Cyan focus
      'color-success': '#00ff00',
      'color-error': '#ff0000',
      'color-warning': '#ffff00',
      'color-info': '#00ffff',

      // Fonts
      'font-display': 'var(--font-righteous)',
      'font-sans': 'var(--font-outfit)',
      'font-mono': 'var(--font-space-mono)',

      // Typography - Aggressive, loud
      'text-xs': '0.75rem',
      'text-sm': '0.875rem',
      'text-base': '1rem',
      'text-md': '1.125rem',
      'text-lg': '1.25rem',
      'text-xl': '1.5rem',
      'text-2xl': '2rem',
      'text-3xl': '3rem',
      'text-4xl': '4rem',
      'text-5xl': '6rem',
      'leading-tight': '0.9',
      'leading-normal': '1.2',
      'leading-relaxed': '1.4',
      'tracking-tighter': '-0.05em',
      'tracking-tight': '-0.02em',
      'tracking-normal': '0',
      'tracking-wide': '0.05em',
      'tracking-wider': '0.1em',

      // Shadows - Hard, deep, contrasting
      'shadow-sm': '2px 2px 0px #000000',
      'shadow-md': '4px 4px 0px #000000',
      'shadow-lg': '8px 8px 0px #000000',
      'shadow-color': '0 0 0',

      // Radius - Mixed: Sharp containers, pill buttons (handled in CSS, defaults here)
      'radius-sm': '0px',
      'radius-md': '0px',
      'radius-lg': '0px',
      'radius-full': '9999px',

      // Spacing - Tight, packed
      'space-1': '0.2rem',
      'space-2': '0.4rem',
      'space-3': '0.8rem',
      'space-4': '1.2rem',
      'space-5': '2rem',
      'space-6': '3rem',
      'space-7': '5rem',
      'space-8': '8rem',

      // Transitions - Snappy, almost instant
      'duration-instant': '0ms',
      'duration-fast': '75ms',
      'duration-normal': '150ms',
      'duration-slow': '300ms',
      'ease-theme': 'steps(4)', // Jerky motion
      'ease-in': 'cubic-bezier(1, 0, 1, 0)',
      'ease-out': 'cubic-bezier(0, 1, 0, 1)',
    },
    dark: {
      // Colors - Neon on void
      'color-primary': '#ccff00', // Acid Green
      'color-primary-hover': '#aadd00',
      'color-primary-active': '#88bb00',
      'color-background': '#050505', // Deep void
      'color-foreground': '#ffffff',
      'color-surface': '#111111',
      'color-surface-hover': '#222222',
      'color-muted': '#222222',
      'color-border': '#666666',
      'color-border-subtle': '#444444',
      'color-text-primary': '#ffffff',
      'color-text-secondary': '#eeeeee',
      'color-text-muted': '#888888',
      'color-text-inverse': '#000000',
      'color-focus-ring': '#ff00ff', // Hot Pink focus
      'color-success': '#00ff00',
      'color-error': '#ff0000',
      'color-warning': '#ffff00',
      'color-info': '#00ffff',

      // Fonts
      'font-display': 'var(--font-righteous)',
      'font-sans': 'var(--font-outfit)',
      'font-mono': 'var(--font-space-mono)',

      // Typography
      'text-xs': '0.75rem',
      'text-sm': '0.875rem',
      'text-base': '1rem',
      'text-md': '1.125rem',
      'text-lg': '1.25rem',
      'text-xl': '1.5rem',
      'text-2xl': '2rem',
      'text-3xl': '3rem',
      'text-4xl': '4rem',
      'text-5xl': '6rem',
      'leading-tight': '0.9',
      'leading-normal': '1.2',
      'leading-relaxed': '1.4',
      'tracking-tighter': '-0.05em',
      'tracking-tight': '-0.02em',
      'tracking-normal': '0',
      'tracking-wide': '0.05em',
      'tracking-wider': '0.1em',

      // Shadows - Hard white on black
      'shadow-sm': '2px 2px 0px #ffffff',
      'shadow-md': '4px 4px 0px #ffffff',
      'shadow-lg': '8px 8px 0px #ffffff',
      'shadow-color': '255 255 255',

      // Radius
      'radius-sm': '0px',
      'radius-md': '0px',
      'radius-lg': '0px',
      'radius-full': '9999px',

      // Spacing
      'space-1': '0.2rem',
      'space-2': '0.4rem',
      'space-3': '0.8rem',
      'space-4': '1.2rem',
      'space-5': '2rem',
      'space-6': '3rem',
      'space-7': '5rem',
      'space-8': '8rem',

      // Transitions
      'duration-instant': '0ms',
      'duration-fast': '75ms',
      'duration-normal': '150ms',
      'duration-slow': '300ms',
      'ease-theme': 'steps(4)',
      'ease-in': 'cubic-bezier(1, 0, 1, 0)',
      'ease-out': 'cubic-bezier(0, 1, 0, 1)',
    },
  },
});
