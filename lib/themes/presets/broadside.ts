import { defineTheme } from '../schema';

/**
 * Broadside Theme — Letterpress Plates, Red and Black
 *
 * Design philosophy:
 * - A pulled letterpress sheet: hard black ink, one press-red plate
 * - Native mode: light (the printed sheet)
 * - Dark mode: the night pressroom, same plates under work light
 *
 * Motion: Mechanical, fast (100ms default)
 * Spacing: Slightly tighter than kenya-standard
 * Typography: 1.414 ratio (Augmented Fourth) — loud display scale
 */
export const broadsideTheme = defineTheme({
  id: 'broadside',
  label: 'Broadside',
  description: 'Letterpress plates, red and black',
  tokens: {
    light: {
      // Colors — paper stock, press red, near-black ink
      'color-primary': '#c41f1f',
      'color-primary-hover': '#a91a1a',
      'color-primary-active': '#8f1616',
      'color-background': '#f2efe9',
      'color-foreground': '#141414',
      'color-surface': '#ffffff',
      'color-surface-hover': '#e9e5dc',
      'color-muted': '#e9e5dc',
      'color-border': '#141414',
      'color-border-subtle': '#d8d4cb',
      'color-text-primary': '#141414',
      'color-text-secondary': '#3a3a3a',
      'color-text-muted': '#5f5f5f',
      'color-text-inverse': '#f2efe9',
      'color-focus-ring': '#141414',
      'color-success': '#18794e',
      'color-error': '#b42318',
      'color-warning': '#8a5a00',
      'color-info': '#075985',

      // Fonts
      'font-display': 'var(--font-anton)',
      'font-sans': 'var(--font-ibm-plex)',
      'font-mono': 'var(--font-jetbrains-mono)',

      // Typography — 1.414 ratio (Augmented Fourth), loud
      'text-xs': '0.75rem',
      'text-sm': '0.875rem',
      'text-base': '1rem',
      'text-md': '1.125rem',
      'text-lg': '1.414rem',
      'text-xl': '2rem',
      'text-2xl': '2.828rem',
      'text-3xl': '4rem',
      'text-4xl': '5.657rem',
      'text-5xl': '8rem',
      'leading-tight': '0.95',
      'leading-normal': '1.3',
      'leading-relaxed': '1.5',
      'tracking-tighter': '-0.04em',
      'tracking-tight': '-0.02em',
      'tracking-normal': '0',
      'tracking-wide': '0.04em',
      'tracking-wider': '0.09em',

      // Shadows — hard offset black, letterpress bite
      'shadow-sm': '2px 2px 0px #141414',
      'shadow-md': '4px 4px 0px #141414',
      'shadow-lg': '8px 8px 0px #141414',
      'shadow-color': '20 20 20',

      // Radius — zero
      'radius-sm': '0px',
      'radius-md': '0px',
      'radius-lg': '0px',
      'radius-full': '9999px',

      // Spacing — slightly tighter than kenya-standard
      'space-1': '0.2rem',
      'space-2': '0.4rem',
      'space-3': '0.85rem',
      'space-4': '1.3rem',
      'space-5': '2.2rem',
      'space-6': '3.5rem',
      'space-7': '5.5rem',
      'space-8': '8rem',

      // Transitions — mechanical, fast
      'duration-instant': '0ms',
      'duration-fast': '60ms',
      'duration-normal': '100ms',
      'duration-slow': '180ms',
      'ease-theme': 'cubic-bezier(0.4, 0, 0.2, 1)',
      'ease-in': 'cubic-bezier(0.5, 0, 1, 0.5)',
      'ease-out': 'cubic-bezier(0, 0.5, 0.5, 1)',
    },
    dark: {
      // Colors — night pressroom, lifted red plate
      'color-primary': '#f04a3e',
      'color-primary-hover': '#f56a60',
      'color-primary-active': '#e04a3e',
      'color-background': '#121212',
      'color-foreground': '#f2efe9',
      'color-surface': '#1c1c1c',
      'color-surface-hover': '#282828',
      'color-muted': '#1c1c1c',
      'color-border': '#f2efe9',
      'color-border-subtle': '#3a3a3a',
      'color-text-primary': '#f2efe9',
      'color-text-secondary': '#c9c5bb',
      'color-text-muted': '#b0b0b0',
      'color-text-inverse': '#1a0503',
      'color-focus-ring': '#f04a3e',
      'color-success': '#66b878',
      'color-error': '#f04a3e',
      'color-warning': '#d4a24a',
      'color-info': '#6f9fd4',

      // Fonts
      'font-display': 'var(--font-anton)',
      'font-sans': 'var(--font-ibm-plex)',
      'font-mono': 'var(--font-jetbrains-mono)',

      // Typography
      'text-xs': '0.75rem',
      'text-sm': '0.875rem',
      'text-base': '1rem',
      'text-md': '1.125rem',
      'text-lg': '1.414rem',
      'text-xl': '2rem',
      'text-2xl': '2.828rem',
      'text-3xl': '4rem',
      'text-4xl': '5.657rem',
      'text-5xl': '8rem',
      'leading-tight': '0.95',
      'leading-normal': '1.3',
      'leading-relaxed': '1.5',
      'tracking-tighter': '-0.04em',
      'tracking-tight': '-0.02em',
      'tracking-normal': '0',
      'tracking-wide': '0.04em',
      'tracking-wider': '0.09em',

      // Shadows — hard offset ivory, work-light bite
      'shadow-sm': '2px 2px 0px #f2efe9',
      'shadow-md': '4px 4px 0px #f2efe9',
      'shadow-lg': '8px 8px 0px #f2efe9',
      'shadow-color': '242 239 233',

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
      'duration-fast': '60ms',
      'duration-normal': '100ms',
      'duration-slow': '180ms',
      'ease-theme': 'cubic-bezier(0.4, 0, 0.2, 1)',
      'ease-in': 'cubic-bezier(0.5, 0, 1, 0.5)',
      'ease-out': 'cubic-bezier(0, 0.5, 0.5, 1)',
    },
  },
});
