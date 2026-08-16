'use client';

import { useUser } from '../lib/auth';

export type RoomQueryArgs =
  | 'skip'
  | {
      roomCode: string;
      guestToken?: string;
    };

export interface RoomQueryArgsDependencies {
  useUser: typeof useUser;
}

const defaultDependencies: RoomQueryArgsDependencies = { useUser };

export function useRoomQueryArgs(
  roomCode: string,
  propToken?: string | null,
  dependencies: RoomQueryArgsDependencies = defaultDependencies
) {
  const {
    guestToken: hookToken,
    isLoading: isAuthLoading,
    authError,
  } = dependencies.useUser();
  const guestToken = propToken ?? hookToken;
  const shouldSkip = !guestToken && (Boolean(authError) || isAuthLoading);
  const queryArgs: RoomQueryArgs = shouldSkip
    ? 'skip'
    : { roomCode, guestToken: guestToken || undefined };

  return { guestToken, shouldSkip, queryArgs };
}
