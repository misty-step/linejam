'use client';

import { useRef, useCallback } from 'react';
import { useTheme, visibleThemeIds } from '@/lib/themes';
import { ThemeModeControl } from './ThemeModeControl';
import { ThemePreview } from './ThemePreview';
import { cn } from '@/lib/utils';

interface ThemeSelectorProps {
  className?: string;
  onClose?: () => void;
}

/**
 * Theme picker with self-styling theme rows and unified mode control.
 *
 * Structure:
 * 1. Mode segmented control (Light/Dark/System) at top
 * 2. Vertical list of theme rows
 */
export function ThemeSelector({ className = '', onClose }: ThemeSelectorProps) {
  const { themeId, mode, setTheme } = useTheme();
  const themeListRef = useRef<HTMLDivElement>(null);
  // A retired active theme (saved before the top-10 roster) renders no row;
  // anchor the roving tabindex on the first row so keyboard users can enter.
  const tabAnchorId = visibleThemeIds.includes(themeId)
    ? themeId
    : visibleThemeIds[0];

  const handleThemeSelect = (id: string) => {
    setTheme(id);
  };

  const focusTheme = useCallback((index: number) => {
    const buttons = themeListRef.current?.querySelectorAll('[role="radio"]');
    (buttons?.[index] as HTMLElement)?.focus();
  }, []);

  const handleThemeKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const currentIndex = visibleThemeIds.indexOf(themeId);

      switch (event.key) {
        case 'ArrowDown': {
          event.preventDefault();
          const nextIndex = (currentIndex + 1) % visibleThemeIds.length;
          setTheme(visibleThemeIds[nextIndex]);
          focusTheme(nextIndex);
          break;
        }
        case 'ArrowUp': {
          event.preventDefault();
          const prevIndex =
            (currentIndex - 1 + visibleThemeIds.length) %
            visibleThemeIds.length;
          setTheme(visibleThemeIds[prevIndex]);
          focusTheme(prevIndex);
          break;
        }
        case 'Home': {
          event.preventDefault();
          setTheme(visibleThemeIds[0]);
          focusTheme(0);
          break;
        }
        case 'End': {
          event.preventDefault();
          const lastIndex = visibleThemeIds.length - 1;
          setTheme(visibleThemeIds[lastIndex]);
          focusTheme(lastIndex);
          break;
        }
        case 'Escape': {
          onClose?.();
          break;
        }
      }
    },
    [themeId, setTheme, onClose, focusTheme]
  );

  return (
    <div className={cn('space-y-4', className)}>
      <ThemeModeControl />

      {/* Theme list */}
      <div
        ref={themeListRef}
        className="flex flex-col gap-2"
        role="radiogroup"
        aria-label="Select theme"
        onKeyDown={handleThemeKeyDown}
      >
        {visibleThemeIds.map((id) => (
          <ThemePreview
            key={id}
            themeId={id}
            isSelected={id === themeId}
            currentMode={mode}
            onSelect={() => handleThemeSelect(id)}
            tabIndex={id === tabAnchorId ? 0 : -1}
          />
        ))}
      </div>
    </div>
  );
}
