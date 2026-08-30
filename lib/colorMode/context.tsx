'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { ColorMode, ColorModePreference } from '@/lib/design';
import { applyColorMode } from './apply';
import { COLOR_MODE_STORAGE_KEY } from './constants';

export interface ColorModeContextValue {
  modePreference: ColorModePreference;
  mode: ColorMode;
  setModePreference: (preference: ColorModePreference) => void;
}

const ColorModeContext = createContext<ColorModeContextValue | null>(null);

function getInitialModePreference(): ColorModePreference {
  if (globalThis.window === undefined) return 'system';
  try {
    const stored = localStorage.getItem(COLOR_MODE_STORAGE_KEY);
    return stored === 'light' || stored === 'dark' || stored === 'system'
      ? stored
      : 'system';
  } catch {
    return 'system';
  }
}

function getSystemMode(): ColorMode {
  if (globalThis.window === undefined) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export function ColorModeProvider({ children }: { children: ReactNode }) {
  const [modePreference, setModePreferenceState] =
    useState<ColorModePreference>(getInitialModePreference);
  const [systemMode, setSystemMode] = useState<ColorMode>(getSystemMode);
  const hasAppliedMode = useRef(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event: MediaQueryListEvent) => {
      setSystemMode(event.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const mode: ColorMode =
    modePreference === 'system' ? systemMode : modePreference;

  useEffect(() => {
    applyColorMode(mode, { transition: hasAppliedMode.current });
    hasAppliedMode.current = true;
  }, [mode]);

  useEffect(() => {
    try {
      localStorage.setItem(COLOR_MODE_STORAGE_KEY, modePreference);
    } catch (error) {
      console.warn('Could not save color mode preference:', error);
    }
  }, [modePreference]);

  const setModePreference = useCallback((preference: ColorModePreference) => {
    setModePreferenceState(preference);
  }, []);

  const value = useMemo(
    () => ({ modePreference, mode, setModePreference }),
    [modePreference, mode, setModePreference]
  );

  return (
    <ColorModeContext.Provider value={value}>
      {children}
    </ColorModeContext.Provider>
  );
}

export function useColorMode(): ColorModeContextValue {
  const context = useContext(ColorModeContext);
  if (!context) {
    throw new Error('useColorMode must be used within ColorModeProvider');
  }
  return context;
}
