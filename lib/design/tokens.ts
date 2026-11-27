import folio from '@/folio/assets/tokens.json';
import type { ColorMode, DesignTokens } from './types';

/**
 * Application tokens are generated from the locked Active Folio token file
 * (`folio/assets/tokens.json`, DESIGN.md [D1-2.5]). No color, radius, easing
 * or duration here is authored independently; every value is read from it.
 *
 * The canonical CSS properties (`--bg`, `--surface`, `--ink`, `--accent`, ...)
 * follow DESIGN.md [D1-3.1]. The older semantic keys (`color-primary`, ...)
 * are aliases onto the same folio values so existing utilities stay correct.
 */
type FolioPalette = (typeof folio)['light'];

const radii = folio.radii;
const motion = folio.motion;
const type = folio.typography;

function modeTokens(c: FolioPalette): DesignTokens {
  return {
    // Canonical folio properties, DESIGN.md [D1-3.1].
    bg: c.bg,
    'bg-desk': c.bgDesk,
    surface: c.surface,
    'surface-subtle': c.surfaceSubtle,
    'surface-elevated': c.surfaceElevated,
    ink: c.ink,
    'ink-secondary': c.inkSecondary,
    'ink-muted': c.inkMuted,
    hairline: c.hairline,
    'hairline-strong': c.hairlineStrong,
    accent: c.accent,
    'accent-hover': c.accentHover,
    'accent-ink': c.accentInk,
    'accent-soft': c.accentSoft,
    'accent-border': c.accentBorder,
    danger: c.danger,
    'danger-soft': c.dangerSoft,
    'danger-border': c.dangerBorder,
    heart: c.heartActive,
    'heart-soft': c.heartSoft,

    // Semantic aliases used by components.
    'color-primary': c.accent,
    'color-primary-hover': c.accentHover,
    'color-primary-active': c.accentHover,
    'color-background': c.bg,
    'color-foreground': c.ink,
    'color-surface': c.surface,
    'color-surface-hover': c.surfaceSubtle,
    'color-muted': c.surfaceSubtle,
    // The boundary that identifies a control uses ink-muted ([D1-3.3]).
    'color-border': c.inkMuted,
    'color-border-subtle': c.hairline,
    'color-text-primary': c.ink,
    'color-text-secondary': c.inkSecondary,
    'color-text-muted': c.inkMuted,
    'color-text-inverse': c.accentInk,
    'color-focus-ring': c.accent,
    'color-success': c.accent,
    'color-error': c.danger,
    'color-warning': c.danger,
    'color-info': c.inkSecondary,

    'font-display': type.serif,
    'font-serif': type.serif,
    'font-sans': type.sans,
    'font-mono': type.mono,
    'text-xs': '0.75rem',
    'text-sm': '0.875rem',
    'text-base': '1rem',
    'text-md': '1.125rem',
    'text-lg': '1.125rem',
    'text-xl': '1.25rem',
    'text-2xl': '1.5rem',
    'text-3xl': '1.875rem',
    'text-4xl': '2.25rem',
    'text-5xl': '3rem',
    'leading-tight': '1.15',
    'leading-normal': '1.5',
    'leading-relaxed': '1.7',
    'tracking-tighter': '-0.02em',
    'tracking-tight': '-0.01em',
    'tracking-normal': '0',
    'tracking-wide': '0.02em',
    'tracking-wider': '0.06em',
    // No drop-shadow soup ([D1-1.3]): only floating layers get one soft shadow.
    'shadow-sm': 'none',
    'shadow-md': 'none',
    'shadow-lg': `0 12px 32px ${c.hairlineStrong}`,
    'radius-tag': radii.tag,
    'radius-control': radii.control,
    'radius-sheet': radii.sheet,
    'radius-sm': radii.tag,
    'radius-md': radii.control,
    'radius-lg': radii.sheet,
    'radius-full': '9999px',
    'space-1': '0.25rem',
    'space-2': '0.5rem',
    'space-3': '1rem',
    'space-4': '1.5rem',
    'space-5': '2.5rem',
    'space-6': '4rem',
    'space-7': '6rem',
    'space-8': '9rem',
    'duration-tap': `${motion.tapMs}ms`,
    'duration-micro': `${motion.microMs}ms`,
    'duration-screen': `${motion.screenMs}ms`,
    'duration-instant': `${motion.tapMs}ms`,
    'duration-fast': `${motion.microMs}ms`,
    'duration-normal': `${motion.screenMs}ms`,
    'duration-slow': `${motion.screenMs}ms`,
    'ease-standard': motion.easeOut,
    'ease-in': motion.easeOut,
    'ease-out': motion.easeOut,
  };
}

/** One Linejam identity, with light and dark appearances. */
export const designTokens = {
  light: modeTokens(folio.light),
  dark: modeTokens(folio.dark),
} as const satisfies Record<ColorMode, DesignTokens>;
