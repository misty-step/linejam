'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type { ColorMode, ColorModePreference } from '@/lib/design';
import { applyColorMode } from './apply';
import { COLOR_MODE_STORAGE_KEY } from './constants';

export interface ColorModeContextValue {
  modePreference: ColorModePreference;
  mode: ColorMode;
  isReady: boolean;
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

// A stable server snapshot keeps every consumer's first render consistent.
// The first-paint script already applies the saved colors before hydration.
const subscribeToHydration = () => () => {};
const clientHydrationSnapshot = () => true;
const serverHydrationSnapshot = () => false;

export function ColorModeProvider({ children }: { children: ReactNode }) {
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    clientHydrationSnapshot,
    serverHydrationSnapshot
  );
  const [preference, setModePreferenceState] = useState<ColorModePreference>(
    getInitialModePreference
  );
  const [systemMode, setSystemMode] = useState<ColorMode>(getSystemMode);
  const hasAppliedMode = useRef(false);
  const modePreference = hydrated ? preference : 'system';

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event: MediaQueryListEvent) => {
      setSystemMode(event.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const mode: ColorMode = !hydrated
    ? 'light'
    : modePreference === 'system'
      ? systemMode
      : modePreference;

  useEffect(() => {
    if (!hydrated) return;
    applyColorMode(mode, { transition: hasAppliedMode.current });
    hasAppliedMode.current = true;
  }, [mode, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(COLOR_MODE_STORAGE_KEY, modePreference);
    } catch (error) {
      console.warn('Could not save color mode preference:', error);
    }
  }, [modePreference, hydrated]);

  const setModePreference = useCallback((preference: ColorModePreference) => {
    setModePreferenceState(preference);
  }, []);

  const value = useMemo(
    () => ({ modePreference, mode, isReady: hydrated, setModePreference }),
    [modePreference, mode, hydrated, setModePreference]
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
