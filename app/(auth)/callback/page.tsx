'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from 'convex/react';
import { useUser } from '@clerk/nextjs';
import { api } from '@/convex/_generated/api';
import { clearGuestSession, getGuestToken } from '@/lib/guestSession';
import { captureError } from '@/lib/error';

export default function AuthCallbackPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();
  const migrateGuestToUser = useMutation(api.migrations.migrateGuestToUser);
  const hasRun = useRef(false);

  useEffect(() => {
    if (!isLoaded || hasRun.current) return;
    hasRun.current = true;

    const guestToken = getGuestToken();

    if (!isSignedIn || !guestToken) {
      router.replace('/');
      return;
    }

    const runMigration = async () => {
      try {
        await migrateGuestToUser({ guestToken });
        clearGuestSession();
      } catch (error) {
        captureError(error, { operation: 'migrateGuestToUser' });
      } finally {
        router.replace('/');
      }
    };

    void runMigration();
  }, [isLoaded, isSignedIn, migrateGuestToUser, router]);

  return (
    <p className="text-lg font-[var(--font-display)] text-[var(--color-text-primary)]">
      Completing sign in...
    </p>
  );
}
