import type { ThemePreset } from '../types';

/**
 * Vintage Paper Theme — Aged Literary Warmth
 *
 * Design philosophy:
 * - Sepia-tinted neutrals
 * - Aged paper background
 * - Muted burgundy accent
 * - Soft blur shadows
 * - Rounded, friendly corners
 * - Slow, gentle transitions
 */
export const vintagePaperTheme: ThemePreset = {
  id: 'vintage-paper',
  label: 'Vintage Paper',
  description: 'Aged literary warmth',
  styles: {
    light: {
      colors: {
        primary: '#8b3a3a',
        primaryHover: '#722e2e',
        primaryActive: '#5c2424',
        background: '#f5efe6',
        foreground: '#3d3632',
        surface: '#fffdf8',
        surfaceHover: '#f0ebe2',
        muted: '#ebe5da',
        border: '#d4cdc2',
        borderSubtle: '#e8e2d8',
        textPrimary: '#3d3632',
        textSecondary: '#5c5650',
        textMuted: '#8a837a',
        textInverse: '#fffdf8',
        focusRing: '#8b3a3a',
        success: '#5a7a5a',
        error: '#9a4a4a',
        warning: '#8a6a3a',
        info: '#4a6a8a',
      },
      fonts: {
        display: 'var(--font-cormorant)',
        sans: 'var(--font-source-serif)',
        mono: 'var(--font-jetbrains-mono)',
      },
      shadows: {
        sm: '0 1px 3px rgba(61, 54, 50, 0.08)',
        md: '0 4px 6px rgba(61, 54, 50, 0.06)',
        lg: '0 10px 20px rgba(61, 54, 50, 0.08)',
        color: '61 54 50',
      },
      radius: {
        sm: '6px',
        md: '8px',
        lg: '12px',
        full: '9999px',
      },
      transitions: {
        instant: '150ms', // Noticeably leisurely
        fast: '300ms',
        normal: '500ms',
        slow: '800ms', // Luxuriously slow
        easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', // Organic spring bounce
        easingIn: 'cubic-bezier(0.16, 1, 0.3, 1)', // Gentle entry
        easingOut: 'cubic-bezier(0.34, 1.56, 0.64, 1)', // Playful overshoot
      },
    },
    dark: {
      colors: {
        primary: '#c76b6b',
        primaryHover: '#d47a7a',
        primaryActive: '#b85c5c',
        background: '#2a2521',
        foreground: '#e8e2d8',
        surface: '#352f2a',
        surfaceHover: '#403834',
        muted: '#352f2a',
        border: '#504840',
        borderSubtle: '#403834',
        textPrimary: '#e8e2d8',
        textSecondary: '#c4bdb4',
        textMuted: '#8a837a',
        textInverse: '#2a2521',
        focusRing: '#c76b6b',
        success: '#7a9a7a',
        error: '#ba6a6a',
        warning: '#aa8a5a',
        info: '#6a8aaa',
      },
      fonts: {
        display: 'var(--font-cormorant)',
        sans: 'var(--font-source-serif)',
        mono: 'var(--font-jetbrains-mono)',
      },
      shadows: {
        sm: '0 1px 3px rgba(0, 0, 0, 0.2)',
        md: '0 4px 6px rgba(0, 0, 0, 0.15)',
        lg: '0 10px 20px rgba(0, 0, 0, 0.2)',
        color: '0 0 0',
      },
      radius: {
        sm: '6px',
        md: '8px',
        lg: '12px',
        full: '9999px',
      },
      transitions: {
        instant: '150ms', // Noticeably leisurely
        fast: '300ms',
        normal: '500ms',
        slow: '800ms', // Luxuriously slow
        easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', // Organic spring bounce
        easingIn: 'cubic-bezier(0.16, 1, 0.3, 1)', // Gentle entry
        easingOut: 'cubic-bezier(0.34, 1.56, 0.64, 1)', // Playful overshoot
      },
    },
  },
};
