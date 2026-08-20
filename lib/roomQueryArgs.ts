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
