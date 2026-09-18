// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import {
  resolveClerkColorVariables,
  useClerkColorVariables,
} from '@/lib/clerk/appearance';
import { designTokens } from '@/lib/design';

function clearRootStyle() {
  const root = document.documentElement;
  for (const key of Array.from(root.style)) {
    if (key.startsWith('--')) root.style.removeProperty(key);
  }
  root.classList.remove('light', 'dark');
}

describe('resolveClerkColorVariables', () => {
  afterEach(clearRootStyle);

  it('passes a resolved primary color to Clerk instead of var()', () => {
    document.documentElement.style.setProperty('--color-primary', '#b43a12');

    const variables = resolveClerkColorVariables();

    expect(variables.colorPrimary).toBe('#b43a12');
    expect(variables.colorPrimary).not.toContain('var(');
  });

  it('reflects changed effective-mode tokens from the document root', () => {
    document.documentElement.style.setProperty('--color-primary', '#f06b3b');

    expect(resolveClerkColorVariables().colorPrimary).toBe('#f06b3b');
  });

  it('uses the fixed light identity before document tokens are applied', () => {
    const variables = resolveClerkColorVariables();

    expect(variables.colorPrimary).toBe(designTokens.light['color-primary']);
    expect(variables.colorBackground).toBe(designTokens.light['color-surface']);
  });

  it('uses the fixed light identity during SSR', () => {
    vi.stubGlobal('document', undefined);
    try {
      const variables = resolveClerkColorVariables();

      expect(variables.colorPrimary).toBe(designTokens.light['color-primary']);
      expect(variables.colorBorder).toBe(designTokens.light['color-border']);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('keeps non-color values as live CSS variable references', () => {
    const variables = resolveClerkColorVariables();

    expect(variables.fontFamily).toBe('var(--font-sans)');
    expect(variables.fontSize).toBe('1rem');
    expect(variables.borderRadius).toBe('var(--radius-md)');
  });
});

describe('useClerkColorVariables', () => {
  afterEach(clearRootStyle);

  it('reacts when effective color-mode tokens change after mount', async () => {
    document.documentElement.style.setProperty('--color-primary', '#b43a12');

    const { result } = renderHook(() => useClerkColorVariables());
    expect(result.current.colorPrimary).toBe('#b43a12');

    act(() => {
      document.documentElement.style.setProperty('--color-primary', '#f06b3b');
      document.documentElement.classList.add('dark');
    });

    await waitFor(() => {
      expect(result.current.colorPrimary).toBe('#f06b3b');
    });
  });
});
