export const AVATAR_IDS = [
  'pip',
  'moss',
  'pebble',
  'orbit',
  'sprout',
  'sunny',
  'ziggy',
  'plum',
] as const;

export type AvatarId = (typeof AVATAR_IDS)[number];

/** Character colors stay with the cast, independent of the page color mode. */
export const AVATAR_COLORS = {
  ink: '#39234E',
  mint: '#B6F1D0',
  peach: '#FFB887',
  lavender: '#D8C3FF',
} as const;

export const AVATAR_NAMES = {
  pip: 'Pip',
  moss: 'Moss',
  pebble: 'Pebble',
  orbit: 'Orbit',
  sprout: 'Sprout',
  sunny: 'Sunny',
  ziggy: 'Ziggy',
  plum: 'Plum',
} as const satisfies Record<AvatarId, string>;

export function isAvatarId(value: string | undefined): value is AvatarId {
  for (const id of AVATAR_IDS) {
    if (id === value) return true;
  }
  return false;
}

/** Stable fallback for older callers and room memberships without a selection. */
export function getDefaultAvatarId(stableId: string): AvatarId {
  let hash = 2166136261;
  for (let index = 0; index < stableId.length; index++) {
    hash = Math.imul(hash ^ stableId.charCodeAt(index), 16777619);
  }
  return AVATAR_IDS[(hash >>> 0) % AVATAR_IDS.length];
}
