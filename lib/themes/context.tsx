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
import type { ThemeMode, ThemeModePreference, ThemePreset } from './types';
import { getTheme, isValidThemeId, defaultThemeId } from './registry';
import { applyTheme } from './apply';

// Storage keys
const STORAGE_KEY_THEME = 'linejam-theme-id';
const STORAGE_KEY_MODE = 'linejam-theme-mode';

export interface ThemeContextValue {
  themeId: string;
  /** User's preference: light, dark, or system */
  modePreference: ThemeModePreference;
  /** The effective/resolved mode (always light or dark) */
  mode: ThemeMode;
  setTheme: (id: string) => void;
  setModePreference: (pref: ThemeModePreference) => void;
  /** @deprecated Use setModePreference instead */
  setMode: (mode: ThemeModePreference) => void;
  /** @deprecated Prefer setModePreference with explicit value */
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
 * Read initial mode preference from localStorage.
 * Defaults to 'system' for new users.
 */
function getInitialModePreference(): ThemeModePreference {
  if (typeof window === 'undefined') return 'system';
  try {
    const stored = localStorage.getItem(STORAGE_KEY_MODE);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
    // Default new users to system preference
    return 'system';
  } catch {
    return 'system';
  }
}

/**
 * Get current system color scheme preference.
 */
function getSystemPreference(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeId] = useState<string>(getInitialTheme);
  const [modePreference, setModePreferenceState] =
    useState<ThemeModePreference>(getInitialModePreference);
  const [systemPreference, setSystemPreference] =
    useState<ThemeMode>(getSystemPreference);

  // Listen to OS color scheme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handler = (e: MediaQueryListEvent) => {
      setSystemPreference(e.matches ? 'dark' : 'light');
    };

    // Initial value already set via useState initializer (getSystemPreference)
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Compute effective mode
  const mode: ThemeMode =
    modePreference === 'system' ? systemPreference : modePreference;

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
      localStorage.setItem(STORAGE_KEY_MODE, modePreference);
    } catch (e) {
      console.warn('Could not save theme preference:', e);
    }
  }, [themeId, modePreference]);

  const setTheme = useCallback((id: string) => {
    setThemeId(id);
  }, []);

  const setModePreference = useCallback((pref: ThemeModePreference) => {
    setModePreferenceState(pref);
  }, []);

  // Legacy: setMode now accepts ThemeModePreference
  const setMode = setModePreference;

  // Legacy: toggle between light and dark (skips system)
  const toggleMode = useCallback(() => {
    setModePreferenceState((prev) => {
      if (prev === 'system') {
        // If on system, toggle to opposite of current effective mode
        return systemPreference === 'dark' ? 'light' : 'dark';
      }
      return prev === 'light' ? 'dark' : 'light';
    });
  }, [systemPreference]);

  const value = useMemo(
    () => ({
      themeId,
      modePreference,
      mode,
      setTheme,
      setModePreference,
      setMode,
      toggleMode,
      // Safe: themeId is validated via isValidThemeId in getInitialTheme
      theme: getTheme(themeId)!,
    }),
    [
      themeId,
      modePreference,
      mode,
      setTheme,
      setModePreference,
      setMode,
      toggleMode,
    ]
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
