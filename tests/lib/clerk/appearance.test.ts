// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import {
  resolveClerkThemeVariables,
  useClerkThemeVariables,
} from '@/lib/clerk/appearance';
import { kenyaTheme } from '@/lib/themes/presets/kenya';

/**
 * Regression coverage for a live bug found while QA-ing linejam-942: Clerk's
 * own default component styles (`.cl-formButtonPrimary { background:
 * var(--accent) }`) load after Tailwind's utilities and win the cascade tie
 * against our `elements` classes (`bg-[var(--color-primary)]`), so the
 * "Continue" button rendered Clerk's stock #2F3037 gray instead of the
 * theme's accent color. `variables` sets Clerk's own custom properties
 * directly instead of fighting that cascade — but Clerk also uses these to
 * compute derived hover/active shades in JS, which needs a real parseable
 * color, not a `var()` reference. This resolves the literal value
 * lib/themes already applied to the document.
 */

function clearRootStyle() {
  const root = document.documentElement;
  for (const key of Array.from(root.style)) {
    if (key.startsWith('--')) root.style.removeProperty(key);
  }
}

describe('resolveClerkThemeVariables', () => {
  afterEach(() => {
    clearRootStyle();
  });

  it('resolves colorPrimary from the applied --color-primary, not a var() passthrough', () => {
    document.documentElement.style.setProperty('--color-primary', '#e85d2b');

    const variables = resolveClerkThemeVariables();

    expect(variables.colorPrimary).toBe('#e85d2b');
    expect(variables.colorPrimary).not.toContain('var(');
  });

  it('reflects a different theme once the document root changes', () => {
    document.documentElement.style.setProperty('--color-primary', '#ff00ff');
    document.documentElement.style.setProperty('--color-background', '#0b0b0b');

    const variables = resolveClerkThemeVariables();

    expect(variables.colorPrimary).toBe('#ff00ff');
  });

  it('falls back to the kenya default when a token is not yet applied', () => {
    // Nothing set on the root — simulates the earliest possible render
    // before the anti-FOUC blocking script has run.
    const variables = resolveClerkThemeVariables();

    expect(variables.colorPrimary).toBe(
      kenyaTheme.tokens.light['color-primary']
    );
    expect(variables.colorBackground).toBe(
      kenyaTheme.tokens.light['color-surface']
    );
  });

  it('falls back to the kenya default during SSR (no document)', () => {
    vi.stubGlobal('document', undefined);
    try {
      const variables = resolveClerkThemeVariables();

      expect(variables.colorPrimary).toBe(
        kenyaTheme.tokens.light['color-primary']
      );
      expect(variables.colorBorder).toBe(
        kenyaTheme.tokens.light['color-border']
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('passes fontFamily/borderRadius through as live CSS variable references', () => {
    // These aren't parsed by Clerk's color-derivation math, so they can stay
    // reactive var() references rather than snapshotted literals.
    const variables = resolveClerkThemeVariables();

    expect(variables.fontFamily).toBe('var(--font-sans)');
    expect(variables.fontSize).toBe('1rem');
    expect(variables.borderRadius).toBe('var(--radius-md)');
  });
});

describe('useClerkThemeVariables', () => {
  afterEach(() => {
    clearRootStyle();
    vi.useRealTimers();
  });

  it('picks up a theme switch applied to the document root after mount', async () => {
    document.documentElement.style.setProperty('--color-primary', '#e85d2b');
    document.documentElement.setAttribute('data-theme', 'kenya');

    const { result } = renderHook(() => useClerkThemeVariables());
    expect(result.current.colorPrimary).toBe('#e85d2b');

    act(() => {
      document.documentElement.style.setProperty('--color-primary', '#ff00ff');
      document.documentElement.setAttribute('data-theme', 'hyper');
    });

    await waitFor(() => {
      expect(result.current.colorPrimary).toBe('#ff00ff');
    });
  });
});
