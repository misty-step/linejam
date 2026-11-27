/**
 * Get the stable identifier for a user.
 * Prefers clerkUserId (permanent) over guestId (session-based).
 */
export function getStableId(
  clerkUserId: string | null | undefined,
  guestId: string | null | undefined
): string {
  return clerkUserId || guestId || 'unknown';
}
