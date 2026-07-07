import { useEffect, useState } from 'react';
import { kenyaTheme } from '@/lib/themes/presets/kenya';

/**
 * Shared Clerk Appearance
 *
 * Single source of truth for how Clerk's prebuilt UI (SignIn, SignUp,
 * UserButton and its "Manage account" modal) is themed. Set once on
 * <ClerkProvider appearance={...}> in app/providers.tsx so every Clerk
 * surface in the app inherits it — not just the two auth pages.
 *
 * Every value is a CSS custom property already driven by the active
 * lib/themes preset (persimmon/mono/hyper/vintage-paper, light or dark),
 * so this never needs to change when a theme is added or edited.
 *
 * Individual pages/components can still pass their own `appearance` prop
 * to override or extend specific elements (Clerk merges component-level
 * appearance on top of the provider-level appearance below).
 */
export const linejamClerkAppearance = {
  elements: {
    // Root container
    rootBox: 'w-full',
    card: 'shadow-none border-0 p-0 bg-transparent',
    // Form
    formButtonPrimary:
      'bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-[var(--color-text-inverse)] font-[var(--font-sans)] font-medium h-12 rounded-[var(--radius-md)] transition-all duration-[var(--duration-normal)]',
    formFieldInput:
      'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-primary)] font-[var(--font-sans)] h-12 rounded-[var(--radius-md)] focus:border-[var(--color-primary)] focus:ring-[var(--color-focus-ring)] focus:ring-2 focus:ring-offset-2',
    formFieldLabel:
      'text-[var(--color-text-secondary)] font-[var(--font-sans)] text-sm',
    formFieldInputShowPasswordButton:
      'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
    // Social buttons
    socialButtonsBlockButton:
      'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-primary)] font-[var(--font-sans)] h-12 rounded-[var(--radius-md)] hover:bg-[var(--color-surface-hover)] transition-all duration-[var(--duration-normal)]',
    socialButtonsBlockButtonText: 'font-medium',
    // Divider
    dividerLine: 'bg-[var(--color-border)]',
    dividerText:
      'text-[var(--color-text-muted)] font-[var(--font-sans)] text-sm',
    // Footer
    footerActionText:
      'text-[var(--color-text-secondary)] font-[var(--font-sans)]',
    footerActionLink:
      'text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] font-medium',
    // Identity preview (after first step)
    identityPreviewText:
      'text-[var(--color-text-primary)] font-[var(--font-sans)]',
    identityPreviewEditButton:
      'text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]',
    // Alert/Error states
    alert:
      'bg-[var(--color-error)]/10 border-[var(--color-error)] text-[var(--color-error)]',
    // OTP input
    otpCodeFieldInput:
      'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-primary)] font-[var(--font-mono)] text-xl rounded-[var(--radius-md)]',
    // UserButton popover + embedded "Manage account" modal
    userButtonPopoverCard:
      'bg-[var(--color-surface)] border border-[var(--color-border)] shadow-[var(--shadow-lg)]',
    userButtonPopoverActionButton:
      'text-[var(--color-text-primary)] font-[var(--font-sans)] hover:bg-[var(--color-surface-hover)]',
    userButtonPopoverActionButtonText: 'font-[var(--font-sans)]',
    userButtonPopoverFooter: 'hidden',
    modalBackdrop: 'bg-[var(--color-background)]/80',
    modalContent: 'bg-[var(--color-surface)]',
  },
  layout: {
    socialButtonsPlacement: 'top' as const,
    socialButtonsVariant: 'blockButton' as const,
  },
};

const FALLBACK_TOKENS = kenyaTheme.tokens.light;

function readCssVar(token: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(`--${token}`)
    .trim();
  return value || fallback;
}

/**
 * Resolve Clerk's `variables` theming knobs (colorPrimary, colorBackground,
 * ...) from the currently applied lib/themes tokens.
 *
 * Why not just reference `var(--color-primary)` here the way the `elements`
 * classes above do? Clerk's own internal stylesheet defines its default
 * component colors as custom properties too, and it loads after Tailwind's
 * utilities in the cascade — at equal specificity, Clerk's own default
 * wins, so `elements` classes referencing our CSS vars are silently
 * overridden (found live while QA-ing linejam-942: the "Continue" button
 * rendered Clerk's stock `#2F3037` gray, not the theme's accent, even with
 * a hand-authored `bg-[var(--color-primary)]` class). `variables` set
 * Clerk's own custom properties directly, which its internal styles read
 * with no cascade fight — but Clerk also uses these to compute derived
 * hover/active shades in JS, which needs a real parseable color, not a
 * `var()` reference. So this reads the resolved literal value lib/themes
 * already applied to the document instead of re-pointing at the variable.
 *
 * A plain function, not a hook, because ClerkProvider sits above
 * ThemeProvider in the tree and has no React context to read the active
 * theme from — {@link useClerkThemeVariables} below calls it on mount and
 * again whenever the document root changes.
 */
export function resolveClerkThemeVariables() {
  return {
    colorPrimary: readCssVar('color-primary', FALLBACK_TOKENS['color-primary']),
    colorPrimaryForeground: readCssVar(
      'color-text-inverse',
      FALLBACK_TOKENS['color-text-inverse']
    ),
    colorDanger: readCssVar(
      'color-error',
      FALLBACK_TOKENS['color-error'] ?? '#ef4444'
    ),
    colorSuccess: readCssVar(
      'color-success',
      FALLBACK_TOKENS['color-success'] ?? '#10b981'
    ),
    colorWarning: readCssVar(
      'color-warning',
      FALLBACK_TOKENS['color-warning'] ?? '#f59e0b'
    ),
    colorBackground: readCssVar(
      'color-surface',
      FALLBACK_TOKENS['color-surface']
    ),
    colorForeground: readCssVar(
      'color-text-primary',
      FALLBACK_TOKENS['color-text-primary']
    ),
    colorMutedForeground: readCssVar(
      'color-text-muted',
      FALLBACK_TOKENS['color-text-muted']
    ),
    colorMuted: readCssVar('color-muted', FALLBACK_TOKENS['color-muted']),
    colorInput: readCssVar('color-surface', FALLBACK_TOKENS['color-surface']),
    colorInputForeground: readCssVar(
      'color-text-primary',
      FALLBACK_TOKENS['color-text-primary']
    ),
    colorBorder: readCssVar('color-border', FALLBACK_TOKENS['color-border']),
    colorNeutral: readCssVar(
      'color-text-primary',
      FALLBACK_TOKENS['color-text-primary']
    ),
    // Not color-derived by Clerk's JS, so these can stay live var()
    // references and keep tracking the active theme with no extra plumbing.
    fontFamily: 'var(--font-sans)',
    fontFamilyButtons: 'var(--font-sans)',
    borderRadius: 'var(--radius-md)',
  };
}

/**
 * React binding for {@link resolveClerkThemeVariables}: re-resolves whenever
 * lib/themes' `applyTheme` mutates `document.documentElement` (its
 * `style`/`data-theme`/mode class), so switching theme or light/dark while a
 * Clerk surface (UserButton popover, embedded account modal) is visible
 * re-themes it without a full page reload.
 */
export function useClerkThemeVariables() {
  const [variables, setVariables] = useState(resolveClerkThemeVariables);

  useEffect(() => {
    const root = document.documentElement;
    const update = () => setVariables(resolveClerkThemeVariables());

    // Pick up whatever lib/themes already applied before this effect ran.
    update();

    const observer = new MutationObserver(update);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ['style', 'data-theme', 'class'],
    });
    return () => observer.disconnect();
  }, []);

  return variables;
}
