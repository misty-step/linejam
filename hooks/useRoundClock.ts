'use client';

import { useEffect, useState } from 'react';

/**
 * A server-anchored countdown. Given the round's start time and a soft
 * duration, returns how much time is left (0..1 fraction remaining) without
 * ever going negative or driving any enforcement — the clock only pressures.
 *
 * Anchored to `roundStartedAt` (server time) rather than a local start so it
 * survives refreshes and reconnects: a player who joins late sees the same
 * remaining time everyone else does.
 */
export function useRoundClock(
  roundStartedAt: number | undefined,
  durationMs: number,
  tickMs = 1000
): { fractionRemaining: number; msRemaining: number; isOvertime: boolean } {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (roundStartedAt === undefined) return;
    const interval = setInterval(() => setNow(Date.now()), tickMs);
    return () => clearInterval(interval);
  }, [roundStartedAt, tickMs]);

  if (roundStartedAt === undefined || durationMs <= 0) {
    return { fractionRemaining: 1, msRemaining: durationMs, isOvertime: false };
  }

  const elapsed = Math.max(0, now - roundStartedAt);
  const msRemaining = Math.max(0, durationMs - elapsed);
  const fractionRemaining = Math.min(1, Math.max(0, msRemaining / durationMs));

  return {
    fractionRemaining,
    msRemaining,
    isOvertime: elapsed >= durationMs,
  };
}
