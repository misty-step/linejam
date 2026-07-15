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
        'flex min-w-0 max-w-full flex-wrap gap-[4px] rounded-[var(--radius-md)] bg-[var(--color-muted)] p-[4px]',
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
              'flex h-auto min-h-[44px] min-w-[min(100%,4.75rem)] flex-[1_1_4.75rem] items-center justify-center gap-[8px] px-[8px] py-[8px]',
              'text-[var(--text-sm)] font-medium',
              'rounded-[var(--radius-sm)]',
              'transition-all duration-[var(--duration-normal)]',
              isActive
                ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-[var(--shadow-sm)]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
            )}
          >
            <Icon className="h-[16px] w-[16px] shrink-0" />
            <span className="min-w-0 break-words leading-tight">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
