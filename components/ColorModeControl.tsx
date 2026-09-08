'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import type { ColorModePreference } from '@/lib/design';
import { useColorMode } from '@/lib/colorMode';
import { cn } from '@/lib/utils';

const MODES = {
  system: { label: 'System', next: 'light', Icon: Monitor },
  light: { label: 'Light', next: 'dark', Icon: Sun },
  dark: { label: 'Dark', next: 'system', Icon: Moon },
} as const satisfies Record<
  ColorModePreference,
  { label: string; next: ColorModePreference; Icon: typeof Monitor }
>;

interface ColorModeControlProps {
  className?: string;
}

export function ColorModeControl({ className = '' }: ColorModeControlProps) {
  const { modePreference, setModePreference, isReady } = useColorMode();
  const { label, next, Icon } = MODES[modePreference];
  const accessibleLabel = `Color mode: ${label}. Switch to ${MODES[next].label}.`;

  return (
    <button
      type="button"
      disabled={!isReady}
      onClick={() => setModePreference(next)}
      aria-label={accessibleLabel}
      title={accessibleLabel}
      className={cn(
        'inline-flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] transition-colors duration-[var(--duration-normal)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background)]',
        className
      )}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}
