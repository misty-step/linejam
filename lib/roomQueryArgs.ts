export type RoomQueryArgs =
  | 'skip'
  | {
      roomCode: string;
      guestToken?: string;
    };

export function buildRoomQueryArgs(
  roomCode: string,
  guestToken: string | null
): Exclude<RoomQueryArgs, 'skip'> {
  return { roomCode, guestToken: guestToken || undefined };
}

/**
 * Draft-owner identity for the room tree, derived once by the single
 * guest-token owner (RoomPageContent) and propagated with the token.
 */
export function buildIdentityKey(
  clerkUserId: string | null | undefined,
  guestId: string | null
): string | null {
  return clerkUserId
    ? `clerk:${clerkUserId}`
    : guestId
      ? `guest:${guestId}`
      : null;
}
