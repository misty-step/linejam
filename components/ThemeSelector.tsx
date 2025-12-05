'use client';

import { useRef, useCallback } from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme, themeIds } from '@/lib/themes';
import type { ThemeId } from '@/lib/themes';
import { ThemePreview } from './ThemePreview';
import { Button } from './ui/Button';

interface ThemeSelectorProps {
  className?: string;
  onClose?: () => void;
}

/**
 * Theme picker with preview cards for all available themes.
 * Includes light/dark mode toggle and keyboard navigation.
 */
export function ThemeSelector({ className = '', onClose }: ThemeSelectorProps) {
  const { themeId, mode, setTheme, toggleMode } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);

  const handleSelect = (id: ThemeId) => {
    setTheme(id);
  };

  const focusTheme = useCallback((index: number) => {
    const buttons = containerRef.current?.querySelectorAll('[role="radio"]');
    (buttons?.[index] as HTMLElement)?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const currentIndex = themeIds.indexOf(themeId);

      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown': {
          event.preventDefault();
          const nextIndex = (currentIndex + 1) % themeIds.length;
          setTheme(themeIds[nextIndex]);
          focusTheme(nextIndex);
          break;
        }
        case 'ArrowLeft':
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
    <div className={className}>
      {/* Theme grid */}
      <div
        ref={containerRef}
        className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4"
        role="radiogroup"
        aria-label="Select theme"
        onKeyDown={handleKeyDown}
      >
        {themeIds.map((id, index) => (
          <ThemePreview
            key={id}
            themeId={id}
            isSelected={id === themeId}
            currentMode={mode}
            onSelect={() => handleSelect(id)}
            tabIndex={id === themeId ? 0 : -1}
            index={index}
          />
        ))}
      </div>

      {/* Mode toggle */}
      <div className="flex justify-center">
        <Button
          variant="outline"
          size="sm"
          onClick={toggleMode}
          aria-label={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`}
        >
          {mode === 'light' ? (
            <>
              <Moon className="w-4 h-4 mr-2" />
              Dark Mode
            </>
          ) : (
            <>
              <Sun className="w-4 h-4 mr-2" />
              Light Mode
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
