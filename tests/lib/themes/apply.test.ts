// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyTheme, getAppliedTheme } from '@/lib/themes';

describe('theme apply helpers', () => {
  beforeEach(() => {
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('style');
    vi.useRealTimers();
  });

  it('falls back to the default theme when an unknown theme id is requested', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    applyTheme('missing-theme', 'light', { transition: false });

    expect(warn).toHaveBeenCalledWith(
      'Theme "missing-theme" not found, using default'
    );
    expect(document.documentElement.getAttribute('data-theme')).toBe('kenya');
    expect(document.documentElement.classList.contains('light')).toBe(true);

    warn.mockRestore();
  });

  it('applies and then clears the transition marker', () => {
    vi.useFakeTimers();

    applyTheme('hyper', 'dark');

    expect(
      document.documentElement.classList.contains('theme-transitioning')
    ).toBe(true);
    expect(document.documentElement.getAttribute('data-theme')).toBe('hyper');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    vi.runAllTimers();

    expect(
      document.documentElement.classList.contains('theme-transitioning')
    ).toBe(false);
  });

  it('reads the applied theme only when the root contains a valid theme id', () => {
    expect(getAppliedTheme()).toBeNull();

    document.documentElement.setAttribute('data-theme', 'hyper');
    document.documentElement.classList.add('dark');

    expect(getAppliedTheme()).toEqual({
      themeId: 'hyper',
      mode: 'dark',
    });

    document.documentElement.setAttribute('data-theme', 'missing-theme');

    expect(getAppliedTheme()).toBeNull();
  });
});
