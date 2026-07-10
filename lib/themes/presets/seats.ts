import { defineTheme } from '../schema';

/**
 * Seats Theme — Dark Parlor, Gold Seat Tokens
 *
 * Design philosophy:
 * - A private-room card table: antique gold tokens on dark felt
 * - Native mode: dark (the evening parlor)
 * - Light mode: the same room by afternoon window light
 *
 * Motion: Smooth, intimate (220ms default)
 * Spacing: Rounded-friendly
 * Typography: 1.25 ratio (Major Third) — intimate
 */
export const seatsTheme = defineTheme({
  id: 'seats',
  label: 'Seats',
  description: 'Dark parlor, gold seat tokens',
  tokens: {
    dark: {
      // Colors — dark felt, antique gold
      'color-primary': '#c9a24b',
      'color-primary-hover': '#d6b262',
      'color-primary-active': '#b28f3f',
      'color-background': '#17140f',
      'color-foreground': '#efe6d6',
      'color-surface': '#221d15',
      'color-surface-hover': '#2c261b',
      'color-muted': '#221d15',
      'color-border': '#3a3223',
      'color-border-subtle': '#221d15',
      'color-text-primary': '#efe6d6',
      'color-text-secondary': '#cbbfa6',
      'color-text-muted': '#948a72',
      'color-text-inverse': '#1f1608',
      'color-focus-ring': '#c9a24b',
      'color-success': '#84b878',
      'color-error': '#c96c5c',
      'color-warning': '#c9a24b',
      'color-info': '#7fa6b8',

      // Fonts
      'font-display': 'var(--font-cormorant)',
      'font-sans': 'var(--font-outfit)',
      'font-mono': 'var(--font-jetbrains-mono)',

      // Typography — 1.25 ratio (Major Third), intimate
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
      'leading-normal': '1.5',
      'leading-relaxed': '1.75',
      'tracking-tighter': '-0.02em',
      'tracking-tight': '-0.01em',
      'tracking-normal': '0',
      'tracking-wide': '0.03em',
      'tracking-wider': '0.06em',

      // Shadows — soft, deep
      'shadow-sm': '0px 2px 4px rgba(0, 0, 0, 0.35)',
      'shadow-md': '0px 4px 12px rgba(0, 0, 0, 0.4)',
      'shadow-lg': '0px 10px 28px rgba(0, 0, 0, 0.45)',
      'shadow-color': '0 0 0',

      // Radius — rounded, friendly
      'radius-sm': '8px',
      'radius-md': '10px',
      'radius-lg': '12px',
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

      // Transitions — smooth
      'duration-instant': '90ms',
      'duration-fast': '160ms',
      'duration-normal': '220ms',
      'duration-slow': '360ms',
      'ease-theme': 'cubic-bezier(0.3, 0.9, 0.35, 1)',
      'ease-in': 'cubic-bezier(0.4, 0, 0.5, 1)',
      'ease-out': 'cubic-bezier(0.2, 1, 0.35, 1)',
    },
    light: {
      // Colors — afternoon parlor, deep gold-brown
      'color-primary': '#7a5c17',
      'color-primary-hover': '#684d13',
      'color-primary-active': '#57400f',
      'color-background': '#f5efe3',
      'color-foreground': '#2a241a',
      'color-surface': '#fdf9ef',
      'color-surface-hover': '#eae2ce',
      'color-muted': '#eae2ce',
      'color-border': '#d8cba8',
      'color-border-subtle': '#e8dfc6',
      'color-text-primary': '#2a241a',
      'color-text-secondary': '#5a5140',
      'color-text-muted': '#8c8168',
      'color-text-inverse': '#f5efe3',
      'color-focus-ring': '#7a5c17',
      'color-success': '#3f7d4c',
      'color-error': '#a3452f',
      'color-warning': '#7a5c17',
      'color-info': '#3a6a7a',

      // Fonts
      'font-display': 'var(--font-cormorant)',
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
      'leading-tight': '1.2',
      'leading-normal': '1.5',
      'leading-relaxed': '1.75',
      'tracking-tighter': '-0.02em',
      'tracking-tight': '-0.01em',
      'tracking-normal': '0',
      'tracking-wide': '0.03em',
      'tracking-wider': '0.06em',

      // Shadows — soft, warm
      'shadow-sm': '0px 2px 4px rgba(122, 92, 23, 0.1)',
      'shadow-md': '0px 4px 12px rgba(122, 92, 23, 0.12)',
      'shadow-lg': '0px 10px 28px rgba(122, 92, 23, 0.14)',
      'shadow-color': '122 92 23',

      // Radius
      'radius-sm': '8px',
      'radius-md': '10px',
      'radius-lg': '12px',
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
      'duration-instant': '90ms',
      'duration-fast': '160ms',
      'duration-normal': '220ms',
      'duration-slow': '360ms',
      'ease-theme': 'cubic-bezier(0.3, 0.9, 0.35, 1)',
      'ease-in': 'cubic-bezier(0.4, 0, 0.5, 1)',
      'ease-out': 'cubic-bezier(0.2, 1, 0.35, 1)',
    },
  },
});
