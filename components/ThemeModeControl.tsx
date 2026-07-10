'use client';

import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '@/lib/themes';
import type { ThemeModePreference } from '@/lib/themes';
import { cn } from '@/lib/utils';

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
 * Light / Dark / System segmented control. Shared by the in-room theme
 * popover (ThemeSelector) and the /themes page.
 */
export function ThemeModeControl({ className = '' }: { className?: string }) {
  const { modePreference, setModePreference } = useTheme();

  return (
    <div
      className={cn(
        'flex p-1 bg-[var(--color-muted)] rounded-[var(--radius-md)]',
        className
      )}
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
  );
}
