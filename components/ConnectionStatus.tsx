'use client';

import { useConvexConnectionState } from 'convex/react';
import { useEffect, useState } from 'react';
import { E2E_TEST_IDS } from '@/lib/e2eTestIds';

type ConnectionNotice = 'offline' | 'reconnecting' | null;
export function ConnectionStatus() {
  const connection = useConvexConnectionState();
  const [browserOnline, setBrowserOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  );

  useEffect(() => {
    const handleOnline = () => setBrowserOnline(true);
    const handleOffline = () => setBrowserOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const notice: ConnectionNotice = !browserOnline
    ? 'offline'
    : connection.isWebSocketConnected
      ? null
      : connection.hasEverConnected || connection.connectionRetries > 0
        ? 'reconnecting'
        : null;

  if (!notice) return null;

  const message =
    notice === 'offline'
      ? 'You are offline. Your draft is safe; Linejam will reconnect automatically.'
      : 'Connection interrupted. Reconnecting…';

  return (
    <div
      data-testid={E2E_TEST_IDS.connectionStatus}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="lj-safe-inline fixed inset-x-0 top-0 z-[60] flex justify-center pt-[max(0.5rem,env(safe-area-inset-top))]"
    >
      <p className="max-w-xl rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/95 px-4 py-2 text-center text-sm text-[var(--color-text-primary)] shadow-[var(--shadow-lg)] backdrop-blur">
        {message}
      </p>
    </div>
  );
}
