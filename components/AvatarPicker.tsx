'use client';

import { EntryIsland } from './EntryIsland';
import { isAvatarId, type AvatarId } from '@/lib/avatars';

export function AvatarPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: AvatarId;
  onChange: (id: AvatarId) => void;
  disabled?: boolean;
}) {
  return (
    <EntryIsland
      kind="avatar-picker"
      value={value}
      disabled={disabled}
      onChange={(id) => {
        if (isAvatarId(id)) onChange(id);
      }}
    />
  );
}
