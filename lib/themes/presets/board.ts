import { defineTheme } from '../schema';

/**
 * Board Theme — Split-Flap Departures Board
 *
 * Design philosophy:
 * - A mechanical departures board: slate metal, amber flap type
 * - Native mode: dark (the terminal hall at night)
 * - Light mode: the daytime terminal, same board under skylights
 *
 * Motion: Clacky, fast with sharp easing (110ms default)
 * Spacing: Tabular/condensed feel
 * Typography: 1.2 ratio (Minor Third) — tabular, condensed
 */
export const boardTheme = defineTheme({
  id: 'board',
  label: 'Board',
  description: 'Split-flap departures board',
  tokens: {
    dark: {
      // Colors — slate metal, amber flap type
      'color-primary': '#f2b632',
      'color-primary-hover': '#f5c655',
      'color-primary-active': '#d9a220',
      'color-background': '#121417',
      'color-foreground': '#f5f2ea',
      'color-surface': '#1b1e23',
      'color-surface-hover': '#252a30',
      'color-muted': '#1b1e23',
      'color-border': '#33383f',
      'color-border-subtle': '#1f232a',
      'color-text-primary': '#f5f2ea',
      'color-text-secondary': '#c6c2b8',
      'color-text-muted': '#b0b0b0',
      'color-text-inverse': '#1a1205',
      'color-focus-ring': '#f2b632',
      'color-success': '#5fc27e',
      'color-error': '#e8604f',
      'color-warning': '#f2b632',
      'color-info': '#5ba8d4',

      // Fonts
      'font-display': 'var(--font-anton)',
      'font-sans': 'var(--font-ibm-plex)',
      'font-mono': 'var(--font-space-mono)',

      // Typography — 1.2 ratio (Minor Third), tabular/condensed
      'text-xs': '0.75rem',
      'text-sm': '0.875rem',
      'text-base': '1rem',
      'text-md': '1.1rem',
      'text-lg': '1.2rem',
      'text-xl': '1.44rem',
      'text-2xl': '1.728rem',
      'text-3xl': '2.074rem',
      'text-4xl': '2.488rem',
      'text-5xl': '2.986rem',
      'leading-tight': '1.0',
      'leading-normal': '1.3',
      'leading-relaxed': '1.5',
      'tracking-tighter': '-0.01em',
      'tracking-tight': '0',
      'tracking-normal': '0.01em',
      'tracking-wide': '0.06em',
      'tracking-wider': '0.12em',

      // Shadows — slab, downward (flap depth)
      'shadow-sm': '0px 2px 0px rgba(0, 0, 0, 0.5)',
      'shadow-md': '0px 4px 0px rgba(0, 0, 0, 0.5)',
      'shadow-lg': '0px 8px 0px rgba(0, 0, 0, 0.5)',
      'shadow-color': '0 0 0',

      // Radius — small
      'radius-sm': '2px',
      'radius-md': '3px',
      'radius-lg': '3px',
      'radius-full': '9999px',

      // Spacing — tabular/condensed
      'space-1': '0.2rem',
      'space-2': '0.4rem',
      'space-3': '0.8rem',
      'space-4': '1.2rem',
      'space-5': '2rem',
      'space-6': '3.2rem',
      'space-7': '5rem',
      'space-8': '7.5rem',

      // Transitions — clacky, fast, sharp easing
      'duration-instant': '20ms',
      'duration-fast': '70ms',
      'duration-normal': '110ms',
      'duration-slow': '200ms',
      'ease-theme': 'cubic-bezier(0.6, 0, 0.4, 1)',
      'ease-in': 'cubic-bezier(0.7, 0, 1, 0.5)',
      'ease-out': 'cubic-bezier(0, 0.5, 0.3, 1)',
    },
    light: {
      // Colors — daytime terminal, amber-brown
      'color-primary': '#8f6508',
      'color-primary-hover': '#795506',
      'color-primary-active': '#654705',
      'color-background': '#eef0f2',
      'color-foreground': '#16181b',
      'color-surface': '#ffffff',
      'color-surface-hover': '#e2e5e8',
      'color-muted': '#e2e5e8',
      'color-border': '#c6cbd1',
      'color-border-subtle': '#dadde1',
      'color-text-primary': '#16181b',
      'color-text-secondary': '#464b50',
      'color-text-muted': '#5f5f5f',
      'color-text-inverse': '#eef0f2',
      'color-focus-ring': '#8f6508',
      'color-success': '#18794e',
      'color-error': '#b42318',
      'color-warning': '#8a5a00',
      'color-info': '#075985',

      // Fonts
      'font-display': 'var(--font-anton)',
      'font-sans': 'var(--font-ibm-plex)',
      'font-mono': 'var(--font-space-mono)',

      // Typography
      'text-xs': '0.75rem',
      'text-sm': '0.875rem',
      'text-base': '1rem',
      'text-md': '1.1rem',
      'text-lg': '1.2rem',
      'text-xl': '1.44rem',
      'text-2xl': '1.728rem',
      'text-3xl': '2.074rem',
      'text-4xl': '2.488rem',
      'text-5xl': '2.986rem',
      'leading-tight': '1.0',
      'leading-normal': '1.3',
      'leading-relaxed': '1.5',
      'tracking-tighter': '-0.01em',
      'tracking-tight': '0',
      'tracking-normal': '0.01em',
      'tracking-wide': '0.06em',
      'tracking-wider': '0.12em',

      // Shadows — slab, downward (flap depth)
      'shadow-sm': '0px 2px 0px rgba(22, 24, 27, 0.15)',
      'shadow-md': '0px 4px 0px rgba(22, 24, 27, 0.15)',
      'shadow-lg': '0px 8px 0px rgba(22, 24, 27, 0.15)',
      'shadow-color': '22 24 27',

      // Radius
      'radius-sm': '2px',
      'radius-md': '3px',
      'radius-lg': '3px',
      'radius-full': '9999px',

      // Spacing
      'space-1': '0.2rem',
      'space-2': '0.4rem',
      'space-3': '0.8rem',
      'space-4': '1.2rem',
      'space-5': '2rem',
      'space-6': '3.2rem',
      'space-7': '5rem',
      'space-8': '7.5rem',

      // Transitions
      'duration-instant': '20ms',
      'duration-fast': '70ms',
      'duration-normal': '110ms',
      'duration-slow': '200ms',
      'ease-theme': 'cubic-bezier(0.6, 0, 0.4, 1)',
      'ease-in': 'cubic-bezier(0.7, 0, 1, 0.5)',
      'ease-out': 'cubic-bezier(0, 0.5, 0.3, 1)',
    },
  },
});
