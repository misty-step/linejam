'use client';

import { useUser } from '../lib/auth';

type RoomQueryArgs =
  | 'skip'
  | {
      roomCode: string;
      guestToken?: string;
    };

export function useRoomQueryArgs(roomCode: string, propToken?: string | null) {
  const {
    guestToken: hookToken,
    isLoading: isAuthLoading,
    authError,
  } = useUser();
  const guestToken = propToken ?? hookToken;
  const shouldSkip = Boolean(authError) || (isAuthLoading && !guestToken);
  const queryArgs: RoomQueryArgs = shouldSkip
    ? 'skip'
    : { roomCode, guestToken: guestToken || undefined };

  return { guestToken, shouldSkip, queryArgs };
}
