/**
 * The Pen Pals cast. Order is load-bearing: getDefaultAvatarId hashes into this list, so a
 * membership that never stored a choice keeps the same character. Each index took over from
 * the first cast's character at that index (docs/convex-migrations.md).
 */
export const AVATAR_IDS = [
  'rhyme',
  'haiku',
  'hush',
  'quill',
  'sonnet',
  'doodle',
  'dusk',
  'ode',
] as const;

export type AvatarId = (typeof AVATAR_IDS)[number];

export const AVATAR_NAMES = {
  rhyme: 'Rhyme',
  haiku: 'Haiku',
  hush: 'Hush',
  quill: 'Quill',
  sonnet: 'Sonnet',
  doodle: 'Doodle',
  dusk: 'Dusk',
  ode: 'Ode',
} as const satisfies Record<AvatarId, string>;

export function isAvatarId(value: string | undefined): value is AvatarId {
  for (const id of AVATAR_IDS) {
    if (id === value) return true;
  }
  return false;
}

/** Pick from the supported cast; sharing a character never prevents joining. */
export function getRandomAvatarId(): AvatarId {
  return AVATAR_IDS[Math.floor(Math.random() * AVATAR_IDS.length)];
}

/** Stable fallback for older callers and room memberships without a selection. */
export function getDefaultAvatarId(stableId: string): AvatarId {
  let hash = 2166136261;
  for (let index = 0; index < stableId.length; index++) {
    hash = Math.imul(hash ^ stableId.charCodeAt(index), 16777619);
  }
  return AVATAR_IDS[(hash >>> 0) % AVATAR_IDS.length];
}
