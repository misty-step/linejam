'use client';

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

  return (
    <fieldset
      className={cn(
        'min-w-0 max-w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-background)] p-1',
        className
      )}
    >
      <legend className="ml-2 px-1 font-mono text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
        Color mode
      </legend>
      <div className="grid min-w-0 max-w-full grid-cols-3 gap-1">
        {MODE_OPTIONS.map(({ value, label }) => (
          <label
            key={value}
            className={cn(
              'flex min-h-11 min-w-0 cursor-pointer items-center justify-center gap-0.5 px-1 py-2 rounded-[var(--radius-sm)]',
              'text-sm font-medium transition-colors duration-[var(--duration-normal)]',
              'has-[:checked]:bg-[var(--color-surface)] has-[:checked]:text-[var(--color-text-primary)] has-[:checked]:shadow-[var(--shadow-sm)]',
              'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]',
              'focus-within:outline-none focus-within:ring-2 focus-within:ring-[var(--color-focus-ring)] focus-within:ring-offset-2 focus-within:ring-offset-[var(--color-background)]'
            )}
          >
            <input
              type="radio"
              name="color-mode"
              value={value}
              checked={modePreference === value}
              autoFocus={modePreference === value}
              onChange={() => setModePreference(value)}
              className="h-4 w-4 shrink-0 accent-[var(--color-primary)]"
            />
            <span className="min-w-0 truncate leading-tight">{label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
