'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import type { ThemeMode, ThemePreset } from './types';
import { getTheme, isValidThemeId, defaultThemeId } from './registry';
import { applyTheme } from './apply';

// Storage keys
const STORAGE_KEY_THEME = 'linejam-theme-id';
const STORAGE_KEY_MODE = 'linejam-theme-mode';

export interface ThemeContextValue {
  themeId: string;
  mode: ThemeMode;
  setTheme: (id: string) => void;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
  theme: ThemePreset;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Read initial theme from localStorage with fallbacks.
 */
function getInitialTheme(): string {
  if (typeof window === 'undefined') return defaultThemeId;
  try {
    const stored = localStorage.getItem(STORAGE_KEY_THEME);
    return isValidThemeId(stored) ? stored : defaultThemeId;
  } catch {
    return defaultThemeId;
  }
}

/**
 * Read initial mode from localStorage or system preference.
 */
function getInitialMode(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  try {
    const stored = localStorage.getItem(STORAGE_KEY_MODE);
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  } catch {
    return 'light';
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeId] = useState<string>(getInitialTheme);
  const [mode, setModeState] = useState<ThemeMode>(getInitialMode);

  // Apply theme on mount (without transition — blocking script handles initial)
  useEffect(() => {
    applyTheme(themeId, mode, { transition: false });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply theme on changes (with transition)
  useEffect(() => {
    applyTheme(themeId, mode, { transition: true });
  }, [themeId, mode]);

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_THEME, themeId);
      localStorage.setItem(STORAGE_KEY_MODE, mode);
    } catch (e) {
      console.warn('Could not save theme preference:', e);
    }
  }, [themeId, mode]);

  const setTheme = useCallback((id: string) => {
    setThemeId(id);
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
  }, []);

  const toggleMode = useCallback(() => {
    setModeState((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const value = useMemo(
    () => ({
      themeId,
      mode,
      setTheme,
      setMode,
      toggleMode,
      // Safe: themeId is validated via isValidThemeId in getInitialTheme
      theme: getTheme(themeId)!,
    }),
    [themeId, mode, setTheme, setMode, toggleMode]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

/**
 * Access theme context. Must be used within ThemeProvider.
 */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
