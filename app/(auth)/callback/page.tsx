'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from 'convex/react';
import { useUser } from '@clerk/nextjs';
import { api } from '@/convex/_generated/api';
import { clearGuestSession, getGuestToken } from '@/lib/guestSession';
import { captureError } from '@/lib/error';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';

export default function AuthCallbackPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();
  const migrateGuestToUser = useMutation(api.migrations.migrateGuestToUser);
  const hasRun = useRef(false);
  const [status, setStatus] = useState<'loading' | 'error'>('loading');

  const migrateGuestSession = useCallback(
    async (guestToken: string) => {
      await migrateGuestToUser({ guestToken });
      clearGuestSession();
      router.replace('/');
    },
    [migrateGuestToUser, router]
  );

  useEffect(() => {
    if (!isLoaded || hasRun.current) return;
    hasRun.current = true;

    const guestToken = getGuestToken();
    if (!isSignedIn || !guestToken) {
      router.replace('/');
      return;
    }

    void migrateGuestSession(guestToken).catch((error) => {
      captureError(error, { operation: 'migrateGuestToUser' });
      setStatus('error');
    });
  }, [isLoaded, isSignedIn, migrateGuestSession, router]);

  const handleRetry = useCallback(() => {
    const guestToken = getGuestToken();
    if (!isSignedIn || !guestToken) {
      router.replace('/');
      return;
    }

    setStatus('loading');
    void migrateGuestSession(guestToken).catch((error) => {
      captureError(error, { operation: 'migrateGuestToUser' });
      setStatus('error');
    });
  }, [isSignedIn, migrateGuestSession, router]);

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)] p-6">
        <div className="max-w-xl w-full space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-[var(--font-display)] text-[var(--color-text-primary)]">
              Could not finish sign in
            </h1>
            <p className="text-[var(--color-text-secondary)] leading-relaxed">
              Your account is ready, but your guest progress could not be moved
              right now.
            </p>
          </div>
          <Alert variant="error">
            Retry the migration or head home and keep playing from a fresh
            session.
          </Alert>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={handleRetry}>Retry migration</Button>
            <Button
              variant="secondary"
              className="sm:flex-1"
              onClick={() => router.replace('/')}
            >
              Go home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-[var(--color-background)] p-6"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex items-center gap-3 text-[var(--color-text-primary)]">
        <span
          className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-primary)]"
          aria-hidden="true"
        />
        <p className="text-lg font-[var(--font-display)] text-[var(--color-text-primary)]">
          Completing sign in...
        </p>
        <span className="sr-only">Completing sign in</span>
      </div>
    </div>
  );
}
