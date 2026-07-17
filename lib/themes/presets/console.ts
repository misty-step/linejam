import { defineTheme } from '../schema';

/**
 * Console Theme — Terminal HUD, Phosphor Green
 *
 * Design philosophy:
 * - A CRT terminal: phosphor green on black, hairline rules, no soft light
 * - Native mode: dark (the terminal)
 * - Light mode: printout mode — deep green ink on paper
 *
 * Motion: Instant-fast (100ms default)
 * Spacing: kenya-standard, monospaced feel
 * Typography: 1.2 ratio (Minor Third) — uniform, tabular
 */
export const consoleTheme = defineTheme({
  id: 'console',
  label: 'Console',
  description: 'Terminal HUD, phosphor green',
  tokens: {
    dark: {
      // Colors — CRT black, phosphor green
      'color-primary': '#2fd94a',
      'color-primary-hover': '#4de868',
      'color-primary-active': '#25b93b',
      'color-background': '#0b0b0b',
      'color-foreground': '#e8e8e8',
      'color-surface': '#151515',
      'color-surface-hover': '#1e1e1e',
      'color-muted': '#151515',
      'color-border': '#2e2e2e',
      'color-border-subtle': '#1c1c1c',
      'color-text-primary': '#e8e8e8',
      'color-text-secondary': '#b3b3b3',
      'color-text-muted': '#b0b0b0',
      'color-text-inverse': '#04120a',
      'color-focus-ring': '#2fd94a',
      'color-success': '#2fd94a',
      'color-error': '#ff5c5c',
      'color-warning': '#e0c341',
      'color-info': '#4fc3e0',

      // Fonts
      'font-display': 'var(--font-jetbrains-mono)',
      'font-sans': 'var(--font-ibm-plex)',
      'font-mono': 'var(--font-jetbrains-mono)',

      // Typography — 1.2 ratio (Minor Third), uniform/tabular
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
      'leading-tight': '1.1',
      'leading-normal': '1.4',
      'leading-relaxed': '1.6',
      'tracking-tighter': '0',
      'tracking-tight': '0',
      'tracking-normal': '0.01em',
      'tracking-wide': '0.05em',
      'tracking-wider': '0.1em',

      // Shadows — none, faint phosphor glow instead
      'shadow-sm': '0px 0px 4px rgba(47, 217, 74, 0.25)',
      'shadow-md': '0px 0px 10px rgba(47, 217, 74, 0.3)',
      'shadow-lg': '0px 0px 20px rgba(47, 217, 74, 0.35)',
      'shadow-color': '47 217 74',

      // Radius — zero
      'radius-sm': '0px',
      'radius-md': '0px',
      'radius-lg': '0px',
      'radius-full': '9999px',

      // Spacing — kenya-standard, slightly tighter
      'space-1': '0.2rem',
      'space-2': '0.4rem',
      'space-3': '0.85rem',
      'space-4': '1.3rem',
      'space-5': '2.2rem',
      'space-6': '3.5rem',
      'space-7': '5.5rem',
      'space-8': '8rem',

      // Transitions — instant-fast
      'duration-instant': '0ms',
      'duration-fast': '50ms',
      'duration-normal': '100ms',
      'duration-slow': '180ms',
      'ease-theme': 'linear',
      'ease-in': 'linear',
      'ease-out': 'linear',
    },
    light: {
      // Colors — printout mode, deep green ink
      'color-primary': '#0f7a28',
      'color-primary-hover': '#0c6621',
      'color-primary-active': '#0a541b',
      'color-background': '#f2f5f0',
      'color-foreground': '#101410',
      'color-surface': '#ffffff',
      'color-surface-hover': '#e6ebe2',
      'color-muted': '#e6ebe2',
      'color-border': '#c7d0c2',
      'color-border-subtle': '#dde4d8',
      'color-text-primary': '#101410',
      'color-text-secondary': '#3c453d',
      'color-text-muted': '#5f5f5f',
      'color-text-inverse': '#f2f5f0',
      'color-focus-ring': '#0f7a28',
      'color-success': '#18794e',
      'color-error': '#b42318',
      'color-warning': '#8a5a00',
      'color-info': '#075985',

      // Fonts
      'font-display': 'var(--font-jetbrains-mono)',
      'font-sans': 'var(--font-ibm-plex)',
      'font-mono': 'var(--font-jetbrains-mono)',

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
      'leading-tight': '1.1',
      'leading-normal': '1.4',
      'leading-relaxed': '1.6',
      'tracking-tighter': '0',
      'tracking-tight': '0',
      'tracking-normal': '0.01em',
      'tracking-wide': '0.05em',
      'tracking-wider': '0.1em',

      // Shadows — none; hairline borders carry separation
      'shadow-sm': 'none',
      'shadow-md': 'none',
      'shadow-lg': 'none',
      'shadow-color': '16 20 16',

      // Radius
      'radius-sm': '0px',
      'radius-md': '0px',
      'radius-lg': '0px',
      'radius-full': '9999px',

      // Spacing
      'space-1': '0.2rem',
      'space-2': '0.4rem',
      'space-3': '0.85rem',
      'space-4': '1.3rem',
      'space-5': '2.2rem',
      'space-6': '3.5rem',
      'space-7': '5.5rem',
      'space-8': '8rem',

      // Transitions
      'duration-instant': '0ms',
      'duration-fast': '50ms',
      'duration-normal': '100ms',
      'duration-slow': '180ms',
      'ease-theme': 'linear',
      'ease-in': 'linear',
      'ease-out': 'linear',
    },
  },
});
