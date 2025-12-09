'use client';

import { useRef, useCallback } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme, themeIds } from '@/lib/themes';
import type { ThemeModePreference } from '@/lib/themes';
import { ThemePreview } from './ThemePreview';
import { cn } from '@/lib/utils';

interface ThemeSelectorProps {
  className?: string;
  onClose?: () => void;
}

const MODE_OPTIONS: {
  value: ThemeModePreference;
  label: string;
  icon: typeof Sun;
}[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

/**
 * Theme picker with self-styling theme rows and unified mode control.
 *
 * Structure:
 * 1. Mode segmented control (Light/Dark/System) at top
 * 2. Vertical list of theme rows
 */
export function ThemeSelector({ className = '', onClose }: ThemeSelectorProps) {
  const { themeId, mode, modePreference, setTheme, setModePreference } =
    useTheme();
  const themeListRef = useRef<HTMLDivElement>(null);

  const handleThemeSelect = (id: string) => {
    setTheme(id);
  };

  const focusTheme = useCallback((index: number) => {
    const buttons = themeListRef.current?.querySelectorAll('[role="radio"]');
    (buttons?.[index] as HTMLElement)?.focus();
  }, []);

  const handleThemeKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const currentIndex = themeIds.indexOf(themeId);

      switch (event.key) {
        case 'ArrowDown': {
          event.preventDefault();
          const nextIndex = (currentIndex + 1) % themeIds.length;
          setTheme(themeIds[nextIndex]);
          focusTheme(nextIndex);
          break;
        }
        case 'ArrowUp': {
          event.preventDefault();
          const prevIndex =
            (currentIndex - 1 + themeIds.length) % themeIds.length;
          setTheme(themeIds[prevIndex]);
          focusTheme(prevIndex);
          break;
        }
        case 'Home': {
          event.preventDefault();
          setTheme(themeIds[0]);
          focusTheme(0);
          break;
        }
        case 'End': {
          event.preventDefault();
          const lastIndex = themeIds.length - 1;
          setTheme(themeIds[lastIndex]);
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
      {/* Mode segmented control */}
      <div
        className="flex p-1 bg-[var(--color-muted)] rounded-[var(--radius-md)]"
        role="tablist"
        aria-label="Color mode"
      >
        {MODE_OPTIONS.map(({ value, label, icon: Icon }) => {
          const isActive = modePreference === value;
          return (
            <button
              key={value}
              role="tab"
              aria-selected={isActive}
              onClick={() => setModePreference(value)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-3 py-2',
                'text-[var(--text-sm)] font-medium',
                'rounded-[var(--radius-sm)]',
                'transition-all duration-[var(--duration-normal)]',
                isActive
                  ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-[var(--shadow-sm)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
              )}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* Theme list */}
      <div
        ref={themeListRef}
        className="flex flex-col gap-2"
        role="radiogroup"
        aria-label="Select theme"
        onKeyDown={handleThemeKeyDown}
      >
        {themeIds.map((id) => (
          <ThemePreview
            key={id}
            themeId={id}
            isSelected={id === themeId}
            currentMode={mode}
            onSelect={() => handleThemeSelect(id)}
            tabIndex={id === themeId ? 0 : -1}
          />
        ))}
      </div>
    </div>
  );
}
