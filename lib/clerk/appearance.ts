import { useEffect, useState } from 'react';
import { designTokens } from '@/lib/design';

/**
 * Shared Clerk appearance for every prebuilt auth and account surface.
 *
 * Clerk needs resolved color literals because its JavaScript derives hover
 * colors from these values. CSS variable references remain safe for fonts and
 * radii, which Clerk does not parse as colors.
 */
export const linejamClerkAppearance = {
  elements: {
    // Root container
    rootBox: 'w-full',
    card: 'shadow-none border-0 p-0 bg-transparent',
    // Form
    formButtonPrimary:
      'bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-[var(--color-text-inverse)] font-sans font-semibold min-h-12 rounded-[var(--radius-md)] transition-colors duration-[var(--duration-fast)]',
    formFieldInput:
      'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-primary)] font-sans text-base h-12 rounded-[var(--radius-md)] focus:border-[var(--color-primary)] focus:ring-[var(--color-focus-ring)] focus:ring-2 focus:ring-offset-2',
    formFieldLabel: 'text-[var(--color-text-secondary)] font-sans text-sm',
    formFieldInputShowPasswordButton:
      'min-h-11 min-w-11 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
    // Social buttons
    socialButtonsBlockButton:
      'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-primary)] font-sans min-h-12 rounded-[var(--radius-md)] hover:bg-[var(--color-surface-hover)] transition-colors duration-[var(--duration-fast)]',
    socialButtonsBlockButtonText: 'font-medium',
    // Divider
    dividerLine: 'bg-[var(--color-border)]',
    dividerText: 'text-[var(--color-text-muted)] font-sans text-sm',
    // Footer
    footerActionText: 'text-[var(--color-text-secondary)] font-sans',
    footerActionLink:
      'inline-flex min-h-11 items-center text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] font-semibold',
    // Identity preview (after first step)
    identityPreviewText: 'text-[var(--color-text-primary)] font-sans',
    identityPreviewEditButton:
      'min-h-11 min-w-11 text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]',
    // Alert/Error states
    alert:
      'bg-[var(--color-error)]/10 border-[var(--color-error)] text-[var(--color-error)]',
    // OTP input
    otpCodeFieldInput:
      'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-primary)] font-sans text-xl tabular-nums min-h-12 rounded-[var(--radius-md)]',
    // UserButton popover + embedded "Manage account" modal
    userButtonPopoverCard:
      'bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)]',
    userButtonPopoverActionButton:
      'text-[var(--color-text-primary)] font-sans hover:bg-[var(--color-surface-hover)]',
    userButtonPopoverActionButtonText: 'font-sans',
    userButtonPopoverFooter: 'hidden',
    modalBackdrop: 'bg-[var(--color-background)]/80',
    modalContent: 'bg-[var(--color-surface)] rounded-[var(--radius-lg)]',
  },
  options: {
    socialButtonsPlacement: 'top' as const,
    socialButtonsVariant: 'blockButton' as const,
  },
};

const FALLBACK_TOKENS = designTokens.light;

function readCssVar(token: string, fallback: string): string {
  if (globalThis.document === undefined) return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(`--${token}`)
    .trim();
  return value || fallback;
}

/**
 * Resolve Clerk's color inputs from the identity tokens currently applied to
 * the document. The fixed light palette is the server-side fallback.
 */
export function resolveClerkColorVariables() {
  return {
    colorPrimary: readCssVar('color-primary', FALLBACK_TOKENS['color-primary']),
    colorPrimaryForeground: readCssVar(
      'color-text-inverse',
      FALLBACK_TOKENS['color-text-inverse']
    ),
    colorDanger: readCssVar('color-error', FALLBACK_TOKENS['color-error']),
    colorSuccess: readCssVar('color-success', FALLBACK_TOKENS['color-success']),
    colorWarning: readCssVar('color-warning', FALLBACK_TOKENS['color-warning']),
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
    // Clerk does not parse these as colors, so live references track mode.
    fontFamily: 'var(--font-sans)',
    fontFamilyButtons: 'var(--font-sans)',
    // iOS Safari zooms focused form controls below 16px. Clerk's default is
    // 13px, so make the no-zoom floor part of the provider contract.
    fontSize: '1rem',
    borderRadius: 'var(--radius-md)',
  };
}

/** Keep Clerk surfaces synchronized with effective light or dark mode. */
export function useClerkColorVariables() {
  const [variables, setVariables] = useState(resolveClerkColorVariables);

  useEffect(() => {
    const root = document.documentElement;
    const update = () => setVariables(resolveClerkColorVariables());

    update();

    const observer = new MutationObserver(update);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ['style', 'class'],
    });
    return () => observer.disconnect();
  }, []);

  return variables;
}
