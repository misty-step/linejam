import { describe, expect, it } from 'vitest';
import { AVATAR_IDS, getDefaultAvatarId, isAvatarId } from '@/lib/avatars';

describe('avatar cast', () => {
  it('accepts every shipped id and rejects anything else', () => {
    for (const id of AVATAR_IDS) {
      expect(isAvatarId(id)).toBe(true);
    }
    for (const rejected of ['', 'PIP', 'pip ', 'wizard', undefined]) {
      expect(isAvatarId(rejected)).toBe(false);
    }
  });

  it('resolves a stable member of the cast for any identifier', () => {
    const identifiers = ['guest-1', 'guest-2', 'user_abcdefghijklmnop', ''];

    for (const identifier of identifiers) {
      const resolved = getDefaultAvatarId(identifier);
      expect(AVATAR_IDS).toContain(resolved);
      expect(getDefaultAvatarId(identifier)).toBe(resolved);
    }
  });
});
