'use client';

import { useConvexConnectionState } from 'convex/react';
import { useEffect, useRef, useState } from 'react';
import { E2E_TEST_IDS } from '@/lib/e2eTestIds';

type ConnectionNotice = 'offline' | 'reconnecting' | null;

const RESTORED_MESSAGE = 'Connection restored.';
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
  const [showRestored, setShowRestored] = useState(false);
  const previousNoticeRef = useRef<ConnectionNotice>(null);

  useEffect(() => {
    if (notice) {
      previousNoticeRef.current = notice;
      return;
    }

    if (previousNoticeRef.current === null) return;

    previousNoticeRef.current = null;
    // This one-shot state update keeps the restored announcement synchronous
    // with the connection transition; the timer only controls its dismissal.
     
    setShowRestored(true);
    const timeoutId = window.setTimeout(() => setShowRestored(false), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  if (!notice && !showRestored) return null;

  const message =
    notice === 'offline'
      ? 'You are offline. Your draft is safe; Linejam will reconnect automatically.'
      : notice === 'reconnecting'
        ? 'Connection interrupted. Reconnecting…'
        : RESTORED_MESSAGE;

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
