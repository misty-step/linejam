// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyColorMode, getAppliedColorMode } from '@/lib/colorMode';
import { designTokens } from '@/lib/design';

describe('color mode application', () => {
  beforeEach(() => {
    document.documentElement.className = '';
    document.documentElement.removeAttribute('style');
    vi.useRealTimers();
  });

  it('applies the fixed identity tokens and effective mode', () => {
    applyColorMode('light', { transition: false });

    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(
      document.documentElement.style.getPropertyValue('--color-primary')
    ).toBe(designTokens.light['color-primary']);
    expect(
      document.documentElement.style.getPropertyValue('--color-focus-ring')
    ).toBe(designTokens.light['color-focus-ring']);
  });

  it('applies dark mode and clears its transition marker', () => {
    vi.useFakeTimers();

    applyColorMode('dark');

    expect(
      document.documentElement.classList.contains('mode-transitioning')
    ).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(
      document.documentElement.style.getPropertyValue('--color-primary')
    ).toBe(designTokens.dark['color-primary']);

    vi.runAllTimers();

    expect(
      document.documentElement.classList.contains('mode-transitioning')
    ).toBe(false);
  });

  it('reads only an explicit effective mode from the document root', () => {
    expect(getAppliedColorMode()).toBeNull();

    document.documentElement.classList.add('dark');
    expect(getAppliedColorMode()).toBe('dark');

    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
    expect(getAppliedColorMode()).toBe('light');
  });
});
