'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { AVATAR_IDS, AVATAR_NAMES, type AvatarId } from '@/lib/avatars';
import { cn } from '@/lib/utils';

interface AvatarPickerProps {
  value: AvatarId;
  onChange: (id: AvatarId) => void;
  disabled?: boolean;
}

export function AvatarPicker({
  value,
  onChange,
  disabled = false,
}: AvatarPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!isOpen) return;

    const returnFocus = triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (disabled) {
      closeRef.current?.focus();
    } else {
      panelRef.current
        ?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')
        ?.focus();
    }

    const closeOutside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !panelRef.current?.contains(event.target) &&
        !triggerRef.current?.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;

      const choices = panelRef.current.querySelectorAll<HTMLButtonElement>(
        'button:not(:disabled)'
      );
      const first = choices[0];
      const last = choices[choices.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (
        (!event.shiftKey && document.activeElement === last) ||
        !panelRef.current.contains(document.activeElement)
      ) {
        event.preventDefault();
        first?.focus();
      }
    };

    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', handleKeyDown);
      returnFocus?.focus({ preventScroll: true });
    };
  }, [isOpen, disabled]);

  return (
    <div className="shrink-0">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((current) => !current)}
        aria-label={`Change avatar, ${AVATAR_NAMES[value]} selected`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={isOpen ? panelId : undefined}
        className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] transition-colors hover:border-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span aria-hidden="true">
          <Avatar
            stableId={value}
            displayName={AVATAR_NAMES[value]}
            avatarId={value}
            size="md"
          />
        </span>
        <span className="absolute -bottom-0.5 -right-0.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5">
          <ChevronDown className="h-3 w-3" aria-hidden="true" />
        </span>
      </button>

      {isOpen && (
        <div className="lj-game-frame lj-viewport-offset lj-safe-frame fixed inset-x-0 z-50 flex items-end justify-center bg-black/25 [--lj-safe-frame-space:0.75rem] sm:items-center">
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${panelId}-title`}
            className="flex max-h-full w-full max-w-xs min-h-0 flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-lg)]"
          >
            <div className="flex shrink-0 items-center justify-between gap-2 pl-4 pr-2 pt-2">
              <h2
                id={`${panelId}-title`}
                className="text-base font-semibold text-[var(--color-text-primary)]"
              >
                Choose your avatar
              </h2>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close avatar picker"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--color-text-secondary)] hover:bg-[var(--color-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div
              role="group"
              aria-labelledby={`${panelId}-title`}
              className="grid min-h-0 grid-cols-[repeat(auto-fit,minmax(min(100%,3.5rem),1fr))] gap-2 overflow-y-auto overscroll-contain p-3"
            >
              {AVATAR_IDS.map((avatarId) => (
                <button
                  key={avatarId}
                  type="button"
                  disabled={disabled}
                  aria-pressed={value === avatarId}
                  onClick={() => {
                    onChange(avatarId);
                    setIsOpen(false);
                  }}
                  className={cn(
                    'flex min-h-20 min-w-0 flex-col items-center justify-center gap-1 rounded-[var(--radius-md)] border-2 px-0.5 py-2 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-inset disabled:cursor-not-allowed disabled:opacity-50',
                    value === avatarId
                      ? 'border-[var(--color-primary)] bg-[var(--color-muted)] text-[var(--color-text-primary)]'
                      : 'border-transparent'
                  )}
                >
                  <span aria-hidden="true">
                    <Avatar
                      stableId={avatarId}
                      displayName={AVATAR_NAMES[avatarId]}
                      avatarId={avatarId}
                      size="md"
                    />
                  </span>
                  <span className="max-w-full break-words text-center text-xs font-semibold">
                    {AVATAR_NAMES[avatarId]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
