'use client';

import { visibleThemeIds } from '@/lib/themes';
import { useThemeRadioNav } from '@/hooks/useThemeRadioNav';
import { ThemeModeControl } from './ThemeModeControl';
import { ThemePreview } from './ThemePreview';
import { cn } from '@/lib/utils';

interface ThemeSelectorProps {
  className?: string;
  onClose?: () => void;
}

/**
 * Compact theme picker for the in-room popover (RoomChrome): mode control on
 * top, self-styling theme rows below. The full specimen experience lives at
 * /themes; this stays in place so players never navigate away mid-game.
 */
export function ThemeSelector({ className = '', onClose }: ThemeSelectorProps) {
  const { themeId, mode, setTheme, listRef, tabAnchorId, handleKeyDown } =
    useThemeRadioNav({ onEscape: onClose });

  return (
    <div className={cn('min-w-0 max-w-full space-y-4', className)}>
      <ThemeModeControl />

      {/* Theme list */}
      <div
        ref={listRef}
        className="flex min-w-0 max-w-full flex-col gap-2"
        role="radiogroup"
        aria-label="Select theme"
        onKeyDown={handleKeyDown}
      >
        {visibleThemeIds.map((id) => (
          <ThemePreview
            key={id}
            themeId={id}
            isSelected={id === themeId}
            currentMode={mode}
            onSelect={() => setTheme(id)}
            tabIndex={id === tabAnchorId ? 0 : -1}
          />
        ))}
      </div>
    </div>
  );
}
