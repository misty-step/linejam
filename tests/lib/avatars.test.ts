import { describe, expect, it } from 'vitest';
import {
  AVATAR_IDS,
  RETIRED_AVATAR_IDS,
  RETIRED_AVATAR_SUCCESSORS,
  currentAvatarId,
  firstCastAvatarId,
  getDefaultAvatarId,
  isAvatarId,
} from '@/lib/avatars';

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

  it('maps each first-cast id to one distinct Pen Pals successor', () => {
    // The mapping applied to stored memberships and to older clients' selections.
    expect(RETIRED_AVATAR_SUCCESSORS).toEqual({
      pip: 'rhyme',
      moss: 'haiku',
      pebble: 'hush',
      orbit: 'quill',
      sprout: 'sonnet',
      sunny: 'doodle',
      ziggy: 'dusk',
      plum: 'ode',
    });
    // Responses answer in first-cast ids; both directions must round-trip.
    for (const retired of RETIRED_AVATAR_IDS) {
      expect(firstCastAvatarId(currentAvatarId(retired))).toBe(retired);
    }
    for (const id of AVATAR_IDS) {
      expect(currentAvatarId(firstCastAvatarId(id))).toBe(id);
    }
  });

  it('keeps a membership without a stored choice on its first-cast successor', () => {
    // Defaults the first cast showed for these identifiers (revision 66d448d).
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
