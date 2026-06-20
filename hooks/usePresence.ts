'use client';

import { useCallback, useEffect } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { PRESENCE_HEARTBEAT_MS } from '../convex/lib/gameRules';

export interface UsePresenceResult {
  /** Call to immediately fire a heartbeat (e.g. on focus restore). */
  ping: () => void;
}

/**
 * Sends periodic presence heartbeats while a room is active.
 * Stops when `roomCode` is empty or the component unmounts.
 * Works for guest and Clerk users — the mutation resolves identity server-side.
 */
export function usePresence(
  roomCode: string | null | undefined,
  guestToken?: string | null
): UsePresenceResult {
  const heartbeat = useMutation(api.presence.heartbeat);

  const ping = useCallback(() => {
    if (!roomCode) return;
    void heartbeat({
      roomCode,
      guestToken: guestToken || undefined,
    }).catch(() => {
      // Heartbeats are best-effort; a failed ping retries on the next tick.
    });
  }, [heartbeat, roomCode, guestToken]);

  useEffect(() => {
    if (!roomCode) return;
    // Fire immediately so presence is fresh, then on interval. `ping` closes
    // over the current guestToken, so when a guest's token resolves the effect
    // re-runs and the first authenticated heartbeat lands right away instead of
    // being dropped and waiting a full interval.
    ping();
    const interval = setInterval(ping, PRESENCE_HEARTBEAT_MS);
    return () => clearInterval(interval);
  }, [roomCode, ping]);

  return { ping };
}
