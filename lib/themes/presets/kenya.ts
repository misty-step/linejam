import type { ThemePreset } from '../types';

/**
 * Kenya Theme — Japanese Editorial Minimalism
 *
 * Design philosophy:
 * - Ma (間): The space between
 * - Ink on Rice Paper: Warm neutrals, organic texture
 * - Persimmon Stamp: One strong accent, confident restraint
 */
export const kenyaTheme: ThemePreset = {
  id: 'kenya',
  label: 'Kenya',
  description: 'Japanese editorial minimalism',
  styles: {
    light: {
      colors: {
        primary: '#e85d2b',
        primaryHover: '#c44521',
        primaryActive: '#a8391a',
        background: '#faf9f7',
        foreground: '#1c1917',
        surface: '#ffffff',
        surfaceHover: '#f5f5f4',
        muted: '#f5f5f4',
        border: '#e7e5e4',
        borderSubtle: '#f5f5f4',
        textPrimary: '#1c1917',
        textSecondary: '#57534e',
        textMuted: '#a8a29e',
        textInverse: '#faf9f7',
        focusRing: '#e85d2b',
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
        info: '#0ea5e9',
      },
      fonts: {
        display: 'var(--font-libre-baskerville)',
        sans: 'var(--font-ibm-plex)',
        mono: 'var(--font-jetbrains-mono)',
      },
      shadows: {
        sm: '2px 2px 0px rgba(232, 93, 43, 0.15)',
        md: '4px 4px 0px rgba(232, 93, 43, 0.1)',
        lg: '8px 8px 0px rgba(232, 93, 43, 0.12)',
        color: '232 93 43',
      },
      radius: {
        sm: '3px',
        md: '4px',
        lg: '6px',
        full: '9999px',
      },
      transitions: {
        instant: '75ms',
        fast: '150ms',
        normal: '250ms',
        easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
      },
    },
    dark: {
      colors: {
        primary: '#e85d2b',
        primaryHover: '#f06b3b',
        primaryActive: '#d54a1f',
        background: '#1c1917',
        foreground: '#faf9f7',
        surface: '#292524',
        surfaceHover: '#3f3f46',
        muted: '#292524',
        border: '#44403c',
        borderSubtle: '#292524',
        textPrimary: '#faf9f7',
        textSecondary: '#d6d3d1',
        textMuted: '#a8a29e',
        textInverse: '#1c1917',
        focusRing: '#e85d2b',
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
        info: '#0ea5e9',
      },
      fonts: {
        display: 'var(--font-libre-baskerville)',
        sans: 'var(--font-ibm-plex)',
        mono: 'var(--font-jetbrains-mono)',
      },
      shadows: {
        sm: '2px 2px 0px rgba(232, 93, 43, 0.2)',
        md: '4px 4px 0px rgba(232, 93, 43, 0.15)',
        lg: '8px 8px 0px rgba(232, 93, 43, 0.18)',
        color: '232 93 43',
      },
      radius: {
        sm: '3px',
        md: '4px',
        lg: '6px',
        full: '9999px',
      },
      transitions: {
        instant: '75ms',
        fast: '150ms',
        normal: '250ms',
        easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
      },
    },
  },
};
