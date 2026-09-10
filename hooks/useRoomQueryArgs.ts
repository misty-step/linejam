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
    clerkUser,
    guestId,
    guestToken: hookToken,
    isLoading: isAuthLoading,
    authError,
    isAuthenticated,
  } = dependencies.useUser();
  const guestToken = isAuthenticated ? null : (propToken ?? hookToken);
  const shouldSkip = Boolean(authError) || isAuthLoading;
  const identityKey = clerkUser
    ? `clerk:${clerkUser.id}`
    : guestId
      ? `guest:${guestId}`
      : null;
  const queryArgs: RoomQueryArgs = shouldSkip
    ? 'skip'
    : { roomCode, guestToken: guestToken || undefined };

  return { guestToken, shouldSkip, queryArgs, identityKey };
}
