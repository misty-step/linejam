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
      typography: {
        // 1.333 ratio (Perfect Fourth) - editorial
        textXs: '0.75rem', // 12px
        textSm: '0.875rem', // 14px
        textBase: '1rem', // 16px
        textMd: '1.125rem', // 18px
        textLg: '1.333rem', // 21px
        textXl: '1.777rem', // 28px
        text2xl: '2.369rem', // 38px
        text3xl: '3.157rem', // 51px
        text4xl: '4.209rem', // 67px
        text5xl: '5.61rem', // 90px
        leadingTight: '1.1',
        leadingNormal: '1.5',
        leadingRelaxed: '1.75',
        trackingTighter: '-0.05em',
        trackingTight: '-0.025em',
        trackingNormal: '0',
        trackingWide: '0.025em',
        trackingWider: '0.05em',
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
      spacing: {
        1: '0.25rem', // 4px
        2: '0.5rem', // 8px
        3: '1rem', // 16px - base
        4: '1.5rem', // 24px
        5: '2.5rem', // 40px
        6: '4rem', // 64px
        7: '6rem', // 96px
        8: '9rem', // 144px
      },
      transitions: {
        instant: '75ms',
        fast: '150ms',
        normal: '250ms',
        slow: '400ms',
        easing: 'cubic-bezier(0.25, 1, 0.5, 1)', // Mechanical, decisive
        easingIn: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
        easingOut: 'cubic-bezier(0.25, 1, 0.5, 1)',
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
      typography: {
        // 1.333 ratio (Perfect Fourth) - editorial
        textXs: '0.75rem',
        textSm: '0.875rem',
        textBase: '1rem',
        textMd: '1.125rem',
        textLg: '1.333rem',
        textXl: '1.777rem',
        text2xl: '2.369rem',
        text3xl: '3.157rem',
        text4xl: '4.209rem',
        text5xl: '5.61rem',
        leadingTight: '1.1',
        leadingNormal: '1.5',
        leadingRelaxed: '1.75',
        trackingTighter: '-0.05em',
        trackingTight: '-0.025em',
        trackingNormal: '0',
        trackingWide: '0.025em',
        trackingWider: '0.05em',
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
      spacing: {
        1: '0.25rem', // 4px
        2: '0.5rem', // 8px
        3: '1rem', // 16px - base
        4: '1.5rem', // 24px
        5: '2.5rem', // 40px
        6: '4rem', // 64px
        7: '6rem', // 96px
        8: '9rem', // 144px
      },
      transitions: {
        instant: '75ms',
        fast: '150ms',
        normal: '250ms',
        slow: '400ms',
        easing: 'cubic-bezier(0.25, 1, 0.5, 1)', // Mechanical, decisive
        easingIn: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
        easingOut: 'cubic-bezier(0.25, 1, 0.5, 1)',
      },
    },
  },
};
