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

  it('keeps a membership without a stored choice on the character it already shows', () => {
    // Each default is the Pen Pals successor of the first cast's default (revision 66d448d).
    const firstCastDefaults = {
      'guest-2': 'rhyme', // was Pip
      'guest-1': 'haiku', // was Moss
      'guest-4': 'hush', // was Pebble
      'guest-3': 'quill', // was Orbit
      'guest-6': 'sonnet', // was Sprout
      'guest-5': 'doodle', // was Sunny
      'guest-0': 'dusk', // was Ziggy
      'guest-7': 'ode', // was Plum
    };

    for (const [identifier, successor] of Object.entries(firstCastDefaults)) {
      expect(getDefaultAvatarId(identifier)).toBe(successor);
    }
  });
});
