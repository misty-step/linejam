// @vitest-environment happy-dom
import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  COLOR_MODE_STORAGE_KEY,
  ColorModeProvider,
  useColorMode,
} from '@/lib/colorMode';
import { installMatchMedia } from '@/tests/helpers/matchMedia';

function wrapper({ children }: { children: ReactNode }) {
  return <ColorModeProvider>{children}</ColorModeProvider>;
}

describe('color mode context', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    document.documentElement.removeAttribute('style');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('requires the provider boundary', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => renderHook(() => useColorMode())).toThrow(
      'useColorMode must be used within ColorModeProvider'
    );
  });

  it('follows system preference changes', async () => {
    const mediaQuery = installMatchMedia(true);
    localStorage.setItem(COLOR_MODE_STORAGE_KEY, 'system');

    const { result } = renderHook(() => useColorMode(), { wrapper });

    expect(result.current.modePreference).toBe('system');
    expect(result.current.mode).toBe('dark');

    await act(async () => {
      mediaQuery.dispatch(false);
    });

    await waitFor(() => {
      expect(result.current.mode).toBe('light');
    });
  });

  it('sets and persists an explicit mode preference', async () => {
    installMatchMedia(false);
    const { result } = renderHook(() => useColorMode(), { wrapper });

    act(() => {
      result.current.setModePreference('dark');
    });

    expect(result.current.modePreference).toBe('dark');
    expect(result.current.mode).toBe('dark');
    await waitFor(() => {
      expect(COLOR_MODE_STORAGE_KEY).toBe('linejam-theme-mode');
      expect(localStorage.getItem(COLOR_MODE_STORAGE_KEY)).toBe('dark');
    });
  });

  it('falls back to system mode when reading storage fails', () => {
    installMatchMedia(false);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });

    const { result } = renderHook(() => useColorMode(), { wrapper });

    expect(result.current.modePreference).toBe('system');
    expect(result.current.mode).toBe('light');
  });

  it('warns when persisting the mode preference fails', async () => {
    installMatchMedia(false);
    const storageError = new Error('quota exceeded');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw storageError;
    });

    renderHook(() => useColorMode(), { wrapper });

    await waitFor(() => {
      expect(warn).toHaveBeenCalledWith(
        'Could not save color mode preference:',
        storageError
      );
    });
  });
});
