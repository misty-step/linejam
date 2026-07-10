'use client';

import { useCallback, useRef } from 'react';
import { useTheme, visibleThemeIds } from '@/lib/themes';

/**
 * Shared roving-radiogroup behavior for theme pickers (/themes page and the
 * in-room ThemeSelector): Arrow/Home/End move selection and focus together;
 * the tab anchor falls back to the first visible theme when the saved theme
 * is retired (which renders no card, so nothing else would be tabbable).
 */
export function useThemeRadioNav(options?: { onEscape?: () => void }) {
  const { themeId, mode, setTheme } = useTheme();
  const listRef = useRef<HTMLDivElement>(null);
  const onEscape = options?.onEscape;

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
