/**
 * Player emblems (DESIGN.md [D1-2.4]). Stored avatar ids are unchanged so
 * existing memberships, poems and archives keep working (PRODUCT.md [L1-5.4]);
 * each stored id now draws the folio emblem at the same index. Order is
 * load-bearing: getDefaultAvatarId hashes into this list.
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

/** Locked folio emblem file for each stored id: folio/assets/emblem-<name>.svg. */
export const AVATAR_EMBLEMS = {
  rhyme: 'loom',
  haiku: 'vesper',
  hush: 'prism',
  quill: 'clover',
  sonnet: 'orrery',
  doodle: 'arch',
  dusk: 'pinwheel',
  ode: 'lattice',
} as const satisfies Record<AvatarId, string>;

/** The emblem's name is its accessible label. */
export const AVATAR_NAMES = {
  rhyme: 'Loom',
  haiku: 'Vesper',
  hush: 'Prism',
  quill: 'Clover',
  sonnet: 'Orrery',
  doodle: 'Arch',
  dusk: 'Pinwheel',
  ode: 'Lattice',
} as const satisfies Record<AvatarId, string>;

export function isAvatarId(value: string | undefined): value is AvatarId {
  for (const id of AVATAR_IDS) {
    if (id === value) return true;
  }
  return false;
}

/** Pick from the supported emblems; sharing an emblem never prevents joining. */
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
