'use client';

import { useCallback, useRef, useSyncExternalStore } from 'react';
import { useTheme, visibleThemeIds, defaultThemeId } from '@/lib/themes';

const emptySubscribe = () => () => {};

/**
 * Shared roving-radiogroup behavior for theme pickers (/themes page and the
 * in-room ThemeSelector): Arrow/Home/End move selection and focus together;
 * the tab anchor falls back to the first visible theme when the saved theme
 * is retired (which renders no card, so nothing else would be tabbable).
 */
export function useThemeRadioNav(options?: { onEscape?: () => void }) {
  const { themeId: storedThemeId, mode: storedMode, setTheme } = useTheme();
  const listRef = useRef<HTMLDivElement>(null);
  const onEscape = options?.onEscape;

  // Hydration safety: the server renders the default theme in light mode
  // (localStorage is client-only), so the first client render must match it
  // exactly or React throws a hydration mismatch (seen live as error #418 on
  // /themes). Swap to the visitor's saved theme/mode right after mount.
  const hydrated = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const themeId = hydrated ? storedThemeId : defaultThemeId;
  const mode = hydrated ? storedMode : 'light';

  const tabAnchorId = visibleThemeIds.includes(themeId)
    ? themeId
    : visibleThemeIds[0];

  const focusRadio = useCallback((index: number) => {
    const radios = listRef.current?.querySelectorAll('[role="radio"]');
    (radios?.[index] as HTMLElement)?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const currentIndex = visibleThemeIds.indexOf(themeId);
      const move = (nextIndex: number) => {
        event.preventDefault();
        setTheme(visibleThemeIds[nextIndex]);
        focusRadio(nextIndex);
      };
      switch (event.key) {
        case 'ArrowDown':
          move((currentIndex + 1) % visibleThemeIds.length);
          break;
        case 'ArrowUp':
          move(
            (currentIndex - 1 + visibleThemeIds.length) % visibleThemeIds.length
          );
          break;
        case 'Home':
          move(0);
          break;
        case 'End':
          move(visibleThemeIds.length - 1);
          break;
        case 'Escape':
          onEscape?.();
          break;
      }
    },
    [themeId, setTheme, focusRadio, onEscape]
  );

  return { themeId, mode, setTheme, listRef, tabAnchorId, handleKeyDown };
}
