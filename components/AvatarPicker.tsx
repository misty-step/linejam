'use client';

import { useId } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { AVATAR_IDS, AVATAR_NAMES, type AvatarId } from '@/lib/avatars';

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
  const groupId = useId();

  return (
    <fieldset
      role="radiogroup"
      aria-labelledby={`${groupId}-label`}
      disabled={disabled}
      className="min-w-0"
    >
      <legend
        id={`${groupId}-label`}
        className="mb-3 text-sm font-semibold text-[var(--color-text-primary)]"
      >
        Choose your avatar
      </legend>
      <div className="mx-auto grid w-full max-w-[18rem] grid-cols-[repeat(auto-fit,minmax(min(100%,3.25rem),1fr))] gap-2">
        {AVATAR_IDS.map((avatarId) => (
          <label key={avatarId} className="min-w-0 cursor-pointer">
            <input
              type="radio"
              name={groupId}
              value={avatarId}
              checked={value === avatarId}
              onChange={() => onChange(avatarId)}
              required
              className="peer sr-only"
            />
            <span className="flex min-h-20 min-w-0 flex-col items-center justify-center gap-1 rounded-lg border-2 border-transparent px-0.5 py-2 text-[var(--color-text-secondary)] peer-checked:border-[var(--color-primary)] peer-checked:bg-[var(--color-muted)] peer-checked:text-[var(--color-text-primary)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--color-focus-ring)] peer-disabled:cursor-not-allowed peer-disabled:opacity-50">
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
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
