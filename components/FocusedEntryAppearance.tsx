'use client';

import { Palette } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { ColorModeControl } from './ColorModeControl';
import { cn } from '@/lib/utils';

interface FocusedEntryAppearanceProps {
  className?: string;
}

/** Appearance access for play-entry screens that intentionally omit Header. */
export function FocusedEntryAppearance({
  className = '',
}: FocusedEntryAppearanceProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!isOpen) return;

    const handlePointer = (event: MouseEvent) => {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-full)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] shadow-[var(--shadow-sm)] transition-colors duration-[var(--duration-normal)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2"
        onClick={() => setIsOpen((current) => !current)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={panelId}
      >
        <Palette className="h-4 w-4" aria-hidden="true" />
        Appearance
      </button>

      {isOpen && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Appearance"
          className="lj-room-popover absolute right-0 top-full z-50 mt-3 w-80 max-w-[calc(100vw-2rem)] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-lg)]"
        >
          <ColorModeControl />
        </div>
      )}
    </div>
  );
}
