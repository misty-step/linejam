// @vitest-environment happy-dom
import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, useTheme } from '@/lib/themes';

function installMatchMedia(initialMatches = false) {
  let changeListener: ((event: MediaQueryListEvent) => void) | null = null;
  const mediaQuery = {
    matches: initialMatches,
    addEventListener: vi.fn(
      (event: string, listener: (event: MediaQueryListEvent) => void) => {
        if (event === 'change') {
          changeListener = listener;
        }
      }
    ),
    removeEventListener: vi.fn(() => {
      changeListener = null;
    }),
    dispatch(matches: boolean) {
      mediaQuery.matches = matches;
      changeListener?.({ matches } as MediaQueryListEvent);
    },
  };

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockReturnValue(mediaQuery),
  });

  return mediaQuery;
}

function wrapper({ children }: { children: ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

describe('theme context', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('style');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('requires the provider boundary', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    expect(() => renderHook(() => useTheme())).toThrow(
      'useTheme must be used within ThemeProvider'
    );

    consoleError.mockRestore();
  });

  it('reads stored values and follows system preference changes', async () => {
    const mediaQuery = installMatchMedia(true);
    localStorage.setItem('linejam-theme-id', 'hyper');
    localStorage.setItem('linejam-theme-mode', 'system');

    const { result } = renderHook(() => useTheme(), { wrapper });

    expect(result.current.themeId).toBe('hyper');
    expect(result.current.modePreference).toBe('system');
    expect(result.current.mode).toBe('dark');

    await act(async () => {
      mediaQuery.dispatch(false);
    });

    await waitFor(() => {
      expect(result.current.mode).toBe('light');
    });
  });

  it('supports legacy setters and toggles without skipping branches', () => {
    installMatchMedia(true);

    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => {
      result.current.setTheme('mono');
    });
    expect(result.current.themeId).toBe('mono');

    act(() => {
      result.current.toggleMode();
    });
    expect(result.current.modePreference).toBe('light');

    act(() => {
      result.current.toggleMode();
    });
    expect(result.current.modePreference).toBe('dark');

    act(() => {
      result.current.toggleMode();
    });
    expect(result.current.modePreference).toBe('light');

    act(() => {
      result.current.setMode('system');
    });
    expect(result.current.modePreference).toBe('system');

    act(() => {
      result.current.setModePreference('dark');
    });
    expect(result.current.modePreference).toBe('dark');
    expect(result.current.mode).toBe('dark');
  });

  it('falls back when reading storage fails', () => {
    installMatchMedia(false);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });

    const { result } = renderHook(() => useTheme(), { wrapper });

    expect(result.current.themeId).toBe('kenya');
    expect(result.current.modePreference).toBe('system');
    expect(result.current.mode).toBe('light');
  });

  it('warns when persisting preferences fails', async () => {
    installMatchMedia(false);
    const storageError = new Error('quota exceeded');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    Object.defineProperty(window.localStorage, 'setItem', {
      configurable: true,
      value: () => {
        throw storageError;
      },
    });

    renderHook(() => useTheme(), { wrapper });

    await waitFor(() => {
      expect(warn).toHaveBeenCalledWith(
        'Could not save theme preference:',
        storageError
      );
    });
  });
});
