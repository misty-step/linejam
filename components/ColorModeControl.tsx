'use client';

import { useId } from 'react';
import type { ColorModePreference } from '@/lib/design';
import { useColorMode } from '@/lib/colorMode';
import { cn } from '@/lib/utils';

const MODE_OPTIONS: readonly {
  value: ColorModePreference;
  label: string;
}[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

interface ColorModeControlProps {
  className?: string;
}

/**
 * The app's single appearance choice. Native radios keep browser-standard
 * arrow-key behavior while their labels provide full-size touch targets.
 */
export function ColorModeControl({ className = '' }: ColorModeControlProps) {
  const { modePreference, setModePreference } = useColorMode();
  const groupName = useId();

  return (
    <fieldset
      className={cn(
        'min-w-0 max-w-full rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-background)] p-1',
        className
      )}
    >
      <legend className="sr-only">Color mode</legend>
      <div className="flex max-w-full flex-wrap gap-1">
        {MODE_OPTIONS.map(({ value, label }) => (
          <label
            key={value}
            className={cn(
              'flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-1 rounded-[var(--radius-md)] px-2 py-2',
              'text-sm font-semibold transition-colors duration-[var(--duration-normal)]',
              'has-[:checked]:bg-[var(--color-surface)] has-[:checked]:text-[var(--color-text-primary)] has-[:checked]:shadow-[var(--shadow-sm)]',
              'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
              'focus-within:outline-none focus-within:ring-2 focus-within:ring-[var(--color-focus-ring)] focus-within:ring-offset-2 focus-within:ring-offset-[var(--color-background)]'
            )}
          >
            <input
              type="radio"
              name={groupName}
              value={value}
              checked={modePreference === value}
              onChange={() => setModePreference(value)}
              className="h-4 w-4 shrink-0 accent-[var(--color-primary)]"
            />
            <span className="leading-tight">{label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
