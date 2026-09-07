'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { ColorModeControl } from './ColorModeControl';
import { cn } from '@/lib/utils';
import { useColorMode } from '@/lib/colorMode';

interface FocusedEntryAppearanceProps {
  className?: string;
  compact?: boolean;
}

/** Shared appearance access for the shell and focused play-entry screens. */
export function FocusedEntryAppearance({
  className = '',
  compact = false,
}: FocusedEntryAppearanceProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { modePreference } = useColorMode();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const ModeIcon =
    modePreference === 'light'
      ? Sun
      : modePreference === 'dark'
        ? Moon
        : Monitor;
  const modeLabel =
    modePreference === 'light'
      ? 'Light'
      : modePreference === 'dark'
        ? 'Dark'
        : 'System';

  useEffect(() => {
    if (!isOpen) return;

    rootRef.current?.querySelector<HTMLInputElement>('input:checked')?.focus();

    const closeOutside = (event: Event) => {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('focusin', closeOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('focusin', closeOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        className={cn(
          'inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-[var(--radius-full)] border border-[var(--color-border)] bg-[var(--color-surface)] py-2 text-sm font-semibold text-[var(--color-text-primary)] transition-colors duration-[var(--duration-normal)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2',
          compact ? 'w-11 px-0' : 'px-3'
        )}
        onClick={() => setIsOpen((current) => !current)}
        aria-label="Appearance"
        title="Appearance"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={panelId}
      >
        <ModeIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
        {!compact && <span>{modeLabel}</span>}
      </button>

      {isOpen && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Appearance"
          className="lj-room-popover absolute right-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-lg)]"
        >
          <ColorModeControl />
        </div>
      )}
    </div>
  );
}
