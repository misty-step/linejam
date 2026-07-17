import { defineTheme } from '../schema';

/**
 * Aloud Theme — Wine-Red Stage, Gold Program Type
 *
 * Design philosophy:
 * - A velvet theatre curtain and a gold-foil program
 * - Native mode: dark (house lights down, stage warm)
 * - Light mode: the matinee, program type on ivory
 *
 * Motion: Theatrical, slower (300ms default)
 * Spacing: Soft-generous
 * Typography: 1.333 ratio (Perfect Fourth) — stately
 */
export const aloudTheme = defineTheme({
  id: 'aloud',
  label: 'Aloud',
  description: 'Wine-red stage, gold program type',
  tokens: {
    dark: {
      // Colors — velvet wine, gold-foil program
      'color-primary': '#d9a441',
      'color-primary-hover': '#e6b559',
      'color-primary-active': '#c2902f',
      'color-background': '#46171c',
      'color-foreground': '#f3e9db',
      'color-surface': '#571f25',
      'color-surface-hover': '#652631',
      'color-muted': '#571f25',
      'color-border': '#743440',
      'color-border-subtle': '#571f25',
      'color-text-primary': '#f3e9db',
      'color-text-secondary': '#dcc9b4',
      'color-text-muted': '#b0b0b0',
      'color-text-inverse': '#2b1508',
      'color-focus-ring': '#d9a441',
      'color-success': '#8fbf7e',
      'color-error': '#e88373',
      'color-warning': '#d9a441',
      'color-info': '#8bafc4',

      // Fonts
      'font-display': 'var(--font-fraunces)',
      'font-sans': 'var(--font-ibm-plex)',
      'font-mono': 'var(--font-jetbrains-mono)',

      // Typography — 1.333 ratio (Perfect Fourth), stately
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
      'leading-normal': '1.55',
      'leading-relaxed': '1.8',
      'tracking-tighter': '-0.02em',
      'tracking-tight': '-0.01em',
      'tracking-normal': '0',
      'tracking-wide': '0.04em',
      'tracking-wider': '0.08em',

      // Shadows — warm gold glow
      'shadow-sm': '0px 2px 6px rgba(217, 164, 65, 0.18)',
      'shadow-md': '0px 4px 14px rgba(217, 164, 65, 0.22)',
      'shadow-lg': '0px 8px 28px rgba(217, 164, 65, 0.26)',
      'shadow-color': '217 164 65',

      // Radius — soft, generous
      'radius-sm': '6px',
      'radius-md': '8px',
      'radius-lg': '10px',
      'radius-full': '9999px',

      // Spacing — soft-generous
      'space-1': '0.3rem',
      'space-2': '0.6rem',
      'space-3': '1.1rem',
      'space-4': '1.65rem',
      'space-5': '2.75rem',
      'space-6': '4.4rem',
      'space-7': '6.6rem',
      'space-8': '9.9rem',

      // Transitions — theatrical, slower
      'duration-instant': '120ms',
      'duration-fast': '200ms',
      'duration-normal': '300ms',
      'duration-slow': '480ms',
      'ease-theme': 'cubic-bezier(0.22, 1, 0.36, 1)',
      'ease-in': 'cubic-bezier(0.35, 0, 0.5, 1)',
      'ease-out': 'cubic-bezier(0.16, 1, 0.3, 1)',
    },
    light: {
      // Colors — matinee program, wine on ivory
      'color-primary': '#8f2734',
      'color-primary-hover': '#7a2029',
      'color-primary-active': '#671b23',
      'color-background': '#f7f0e4',
      'color-foreground': '#2b1a16',
      'color-surface': '#fffaf2',
      'color-surface-hover': '#ede4d3',
      'color-muted': '#ede4d3',
      'color-border': '#dccbb1',
      'color-border-subtle': '#ece2cd',
      'color-text-primary': '#2b1a16',
      'color-text-secondary': '#5c4038',
      'color-text-muted': '#5f5f5f',
      'color-text-inverse': '#f7f0e4',
      'color-focus-ring': '#8f2734',
      'color-success': '#18794e',
      'color-error': '#b42318',
      'color-warning': '#8a5a00',
      'color-info': '#075985',

      // Fonts
      'font-display': 'var(--font-fraunces)',
      'font-sans': 'var(--font-ibm-plex)',
      'font-mono': 'var(--font-jetbrains-mono)',

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
      'leading-tight': '1.2',
      'leading-normal': '1.55',
      'leading-relaxed': '1.8',
      'tracking-tighter': '-0.02em',
      'tracking-tight': '-0.01em',
      'tracking-normal': '0',
      'tracking-wide': '0.04em',
      'tracking-wider': '0.08em',

      // Shadows — warm wine glow
      'shadow-sm': '0px 2px 6px rgba(143, 39, 52, 0.1)',
      'shadow-md': '0px 4px 14px rgba(143, 39, 52, 0.12)',
      'shadow-lg': '0px 8px 28px rgba(143, 39, 52, 0.14)',
      'shadow-color': '143 39 52',

      // Radius
      'radius-sm': '6px',
      'radius-md': '8px',
      'radius-lg': '10px',
      'radius-full': '9999px',

      // Spacing
      'space-1': '0.3rem',
      'space-2': '0.6rem',
      'space-3': '1.1rem',
      'space-4': '1.65rem',
      'space-5': '2.75rem',
      'space-6': '4.4rem',
      'space-7': '6.6rem',
      'space-8': '9.9rem',

      // Transitions
      'duration-instant': '120ms',
      'duration-fast': '200ms',
      'duration-normal': '300ms',
      'duration-slow': '480ms',
      'ease-theme': 'cubic-bezier(0.22, 1, 0.36, 1)',
      'ease-in': 'cubic-bezier(0.35, 0, 0.5, 1)',
      'ease-out': 'cubic-bezier(0.16, 1, 0.3, 1)',
    },
  },
});
