/**
 * The Pen Pals cast. Order is load-bearing: getDefaultAvatarId hashes into this list, and
 * index i succeeds the first cast's i-th character, so a membership that never stored a
 * choice keeps the successor of the character it showed before.
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

/**
 * Retired first-cast ids and their Pen Pals successors. Stored memberships are rewritten by
 * `migrations.migrateAvatarIds`; these and every legacy path go when the schema contracts
 * (docs/convex-migrations.md).
 */
export const RETIRED_AVATAR_IDS = [
  'pip',
  'moss',
  'pebble',
  'orbit',
  'sprout',
  'sunny',
  'ziggy',
  'plum',
] as const;

export type RetiredAvatarId = (typeof RETIRED_AVATAR_IDS)[number];

export const RETIRED_AVATAR_SUCCESSORS = {
  pip: 'rhyme',
  moss: 'haiku',
  pebble: 'hush',
  orbit: 'quill',
  sprout: 'sonnet',
  sunny: 'doodle',
  ziggy: 'dusk',
  plum: 'ode',
} as const satisfies Record<RetiredAvatarId, AvatarId>;

/** Every id the database may still hold while retired ids are migrated. */
export type StoredAvatarId = AvatarId | RetiredAvatarId;

export const STORED_AVATAR_IDS = [
  ...AVATAR_IDS,
  ...RETIRED_AVATAR_IDS,
] as const;

export function isAvatarId(value: string | undefined): value is AvatarId {
  for (const id of AVATAR_IDS) {
    if (id === value) return true;
  }
  return false;
}

export function isRetiredAvatarId(
  value: string | undefined
): value is RetiredAvatarId {
  for (const id of RETIRED_AVATAR_IDS) {
    if (id === value) return true;
  }
  return false;
}

/**
 * The first-cast id a stored choice answers with until the contraction release: bundles
 * from before Pen Pals can draw only first-cast ids. The casts are index-aligned.
 */
export function firstCastAvatarId(stored: StoredAvatarId): RetiredAvatarId {
  return isRetiredAvatarId(stored)
    ? stored
    : RETIRED_AVATAR_IDS[AVATAR_IDS.indexOf(stored)];
}

/** The Pen Pals character for a stored id, mapping retired ids to their successor. */
export function currentAvatarId(stored: StoredAvatarId): AvatarId {
  return isRetiredAvatarId(stored) ? RETIRED_AVATAR_SUCCESSORS[stored] : stored;
}

/** The character a membership shows: its stored choice, or the stable default. */
export function resolveAvatarId(
  stored: StoredAvatarId | undefined,
  stableId: string
): AvatarId {
  return stored === undefined
    ? getDefaultAvatarId(stableId)
    : currentAvatarId(stored);
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
