'use client';

import { useEffect, useRef } from 'react';
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
  const tokenRef = useRef(guestToken);

  useEffect(() => {
    tokenRef.current = guestToken;
  }, [guestToken]);

  const ping = () => {
    if (!roomCode) return;
    void heartbeat({
      roomCode,
      guestToken: tokenRef.current || undefined,
    }).catch(() => {
      // Heartbeats are best-effort; a failed ping retries on the next tick.
    });
  };

  useEffect(() => {
    if (!roomCode) return;

    // Fire immediately on mount so presence is fresh, then on interval.
    ping();
    const interval = setInterval(ping, PRESENCE_HEARTBEAT_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);

  return { ping };
}
