'use client';

import { useId, type KeyboardEvent } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { AVATAR_IDS, AVATAR_NAMES, type AvatarId } from '@/lib/avatars';
import { cn } from '@/lib/utils';

interface EmblemPickerProps {
  value: AvatarId;
  onChange: (id: AvatarId) => void;
  disabled?: boolean;
}

/**
 * The eight cast emblems as one radio group (DESIGN.md [D1-2.4], [D1-4.4]).
 * Each emblem's name is its accessible label; the selected one turns accent.
 */
export function EmblemPicker({
  value,
  onChange,
  disabled = false,
}: EmblemPickerProps) {
  const labelId = useId();

  const move = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0;
    if (!step) return;
    event.preventDefault();
    const next =
      AVATAR_IDS[(index + step + AVATAR_IDS.length) % AVATAR_IDS.length];
    onChange(next);
    const group = event.currentTarget.parentElement;
    group
      ?.querySelector<HTMLButtonElement>(`[data-emblem-id="${next}"]`)
      ?.focus();
  };

  return (
    <div className="space-y-1.5">
      <span
        id={labelId}
        className="block text-sm font-semibold text-[var(--ink)]"
      >
        Emblem
      </span>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className="grid grid-cols-4 gap-2"
      >
        {AVATAR_IDS.map((avatarId, index) => {
          const selected = value === avatarId;
          return (
            <button
              key={avatarId}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={AVATAR_NAMES[avatarId]}
              data-emblem-id={avatarId}
              tabIndex={selected ? 0 : -1}
              disabled={disabled}
              onClick={() => onChange(avatarId)}
              onKeyDown={(event) => move(event, index)}
              className={cn(
                'flex min-h-14 min-w-11 items-center justify-center rounded-[var(--radius-control)] border transition-colors duration-[var(--duration-micro)] disabled:cursor-not-allowed disabled:opacity-50',
                selected
                  ? 'border-[var(--accent-border)] bg-[var(--accent-soft)]'
                  : 'border-[var(--hairline)] bg-[var(--surface)] hover:border-[var(--hairline-strong)]'
              )}
            >
              <Avatar
                stableId={avatarId}
                avatarId={avatarId}
                size="lg"
                tone={selected ? 'accent' : 'ink'}
                className="pointer-events-none"
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
