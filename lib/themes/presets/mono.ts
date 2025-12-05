import type { ThemePreset } from '../types';

/**
 * Mono Theme — Stark Calligraphic Simplicity
 *
 * Design philosophy:
 * - Pure black and white only
 * - No accent color — grayscale hierarchy
 * - Sharp shadows, zero radius
 * - Fast, snappy transitions
 */
export const monoTheme: ThemePreset = {
  id: 'mono',
  label: 'Mono',
  description: 'Stark calligraphic simplicity',
  styles: {
    light: {
      colors: {
        primary: '#000000',
        primaryHover: '#262626',
        primaryActive: '#404040',
        background: '#ffffff',
        foreground: '#000000',
        surface: '#ffffff',
        surfaceHover: '#f5f5f5',
        muted: '#f5f5f5',
        border: '#000000',
        borderSubtle: '#e5e5e5',
        textPrimary: '#000000',
        textSecondary: '#404040',
        textMuted: '#737373',
        textInverse: '#ffffff',
        focusRing: '#000000',
      },
      fonts: {
        display: 'var(--font-noto-serif)',
        sans: 'var(--font-inter)',
        mono: 'var(--font-jetbrains-mono)',
      },
      typography: {
        // 1.25 ratio (Major Third) - compact, systematic
        textXs: '0.64rem', // 10px - fine print
        textSm: '0.8rem', // 13px
        textBase: '1rem', // 16px
        textMd: '1.125rem', // 18px
        textLg: '1.25rem', // 20px
        textXl: '1.563rem', // 25px
        text2xl: '1.953rem', // 31px
        text3xl: '2.441rem', // 39px
        text4xl: '3.052rem', // 49px
        text5xl: '3.815rem', // 61px - sharp, not huge
        leadingTight: '1.0', // Touching headlines
        leadingNormal: '1.3', // Compact
        leadingRelaxed: '1.5',
        trackingTighter: '-0.03em',
        trackingTight: '-0.015em',
        trackingNormal: '0',
        trackingWide: '0.05em',
        trackingWider: '0.1em', // Architectural
      },
      shadows: {
        sm: 'none', // Swiss modernism: no shadows, use borders
        md: 'none',
        lg: 'none',
        color: '0 0 0',
      },
      radius: {
        sm: '0px',
        md: '0px',
        lg: '0px',
        full: '9999px',
      },
      spacing: {
        1: '0.125rem', // 2px - ultra tight
        2: '0.25rem', // 4px
        3: '0.5rem', // 8px - compact base
        4: '1rem', // 16px
        5: '1.5rem', // 24px
        6: '2rem', // 32px
        7: '3rem', // 48px
        8: '4rem', // 64px
      },
      transitions: {
        instant: '0ms', // Instant feedback
        fast: '50ms', // Subliminal snap
        normal: '100ms', // Just perceptible
        slow: '150ms', // Still fast
        easing: 'cubic-bezier(0.4, 0, 1, 1)', // Sharp deceleration
        easingIn: 'cubic-bezier(0.4, 0, 1, 1)',
        easingOut: 'cubic-bezier(0, 0, 0.2, 1)', // Material snap
      },
    },
    dark: {
      colors: {
        primary: '#ffffff',
        primaryHover: '#e5e5e5',
        primaryActive: '#d4d4d4',
        background: '#000000',
        foreground: '#ffffff',
        surface: '#171717',
        surfaceHover: '#262626',
        muted: '#171717',
        border: '#ffffff',
        borderSubtle: '#262626',
        textPrimary: '#ffffff',
        textSecondary: '#d4d4d4',
        textMuted: '#737373',
        textInverse: '#000000',
        focusRing: '#ffffff',
      },
      fonts: {
        display: 'var(--font-noto-serif)',
        sans: 'var(--font-inter)',
        mono: 'var(--font-jetbrains-mono)',
      },
      typography: {
        // 1.25 ratio (Major Third) - compact, systematic
        textXs: '0.64rem',
        textSm: '0.8rem',
        textBase: '1rem',
        textMd: '1.125rem',
        textLg: '1.25rem',
        textXl: '1.563rem',
        text2xl: '1.953rem',
        text3xl: '2.441rem',
        text4xl: '3.052rem',
        text5xl: '3.815rem',
        leadingTight: '1.0',
        leadingNormal: '1.3',
        leadingRelaxed: '1.5',
        trackingTighter: '-0.03em',
        trackingTight: '-0.015em',
        trackingNormal: '0',
        trackingWide: '0.05em',
        trackingWider: '0.1em',
      },
      shadows: {
        sm: 'none', // Swiss modernism: no shadows, use borders
        md: 'none',
        lg: 'none',
        color: '255 255 255',
      },
      radius: {
        sm: '0px',
        md: '0px',
        lg: '0px',
        full: '9999px',
      },
      spacing: {
        1: '0.125rem', // 2px - ultra tight
        2: '0.25rem', // 4px
        3: '0.5rem', // 8px - compact base
        4: '1rem', // 16px
        5: '1.5rem', // 24px
        6: '2rem', // 32px
        7: '3rem', // 48px
        8: '4rem', // 64px
      },
      transitions: {
        instant: '0ms', // Instant feedback
        fast: '50ms', // Subliminal snap
        normal: '100ms', // Just perceptible
        slow: '150ms', // Still fast
        easing: 'cubic-bezier(0.4, 0, 1, 1)', // Sharp deceleration
        easingIn: 'cubic-bezier(0.4, 0, 1, 1)',
        easingOut: 'cubic-bezier(0, 0, 0.2, 1)', // Material snap
      },
    },
  },
};
