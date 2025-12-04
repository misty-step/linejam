/**
 * Avatar Color System
 *
 * Generates deterministic colors for player avatars with collision resolution.
 * Colors are derived from stable user identifiers (guestId or clerkUserId)
 * with guaranteed uniqueness within a room.
 */

// 12-color palette designed for:
// - Warmth (fits ink/paper aesthetic)
// - Visual distinction between adjacent colors
const AVATAR_PALETTE = [
  '#e85d2b', // Persimmon (primary)
  '#c2410c', // Burnt sienna
  '#0d9488', // Teal
  '#7c3aed', // Violet
  '#db2777', // Pink
  '#ea580c', // Orange
  '#0891b2', // Cyan
  '#4f46e5', // Indigo
  '#65a30d', // Lime
  '#b45309', // Amber
  '#1e40af', // Blue
  '#059669', // Emerald
] as const;

export type AvatarColor = (typeof AVATAR_PALETTE)[number];

/**
 * Hash a string to a palette index.
 */
function hashToIndex(stableId: string): number {
  let hash = 0;
  for (let i = 0; i < stableId.length; i++) {
    hash = (hash << 5) - hash + stableId.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash) % AVATAR_PALETTE.length;
}

/**
 * Get unique color for a user within a room context.
 * Guarantees no duplicate colors by shifting to next available on collision.
 *
 * @param stableId - This user's stable ID
 * @param allStableIds - All players' stable IDs in the room
 * @returns A hex color string guaranteed unique within the room
 */
export function getUniqueColor(
  stableId: string,
  allStableIds: string[]
): AvatarColor {
  // Sort IDs to ensure consistent ordering across all clients
  const sorted = [...allStableIds].sort();

  const takenIndices = new Set<number>();

  for (const id of sorted) {
    let idx = hashToIndex(id);
    // Find next available color if collision
    while (takenIndices.has(idx)) {
      idx = (idx + 1) % AVATAR_PALETTE.length;
    }

    if (id === stableId) {
      return AVATAR_PALETTE[idx];
    }

    takenIndices.add(idx);
  }

  // Fallback (stableId not in list - shouldn't happen)
  return AVATAR_PALETTE[hashToIndex(stableId)];
}

/**
 * Get color for single user context (no collision resolution).
 * Use this for Profile page where there's no room context.
 */
export function getUserColor(stableId: string): AvatarColor {
  return AVATAR_PALETTE[hashToIndex(stableId)];
}

/**
 * Get the stable identifier for a user.
 * Prefers clerkUserId (permanent) over guestId (session-based).
 *
 * @param clerkUserId - The Clerk user ID (if authenticated)
 * @param guestId - The guest ID (if anonymous)
 * @returns The stable identifier to use for color generation
 */
export function getStableId(
  clerkUserId: string | null | undefined,
  guestId: string | null | undefined
): string {
  return clerkUserId || guestId || 'unknown';
}
