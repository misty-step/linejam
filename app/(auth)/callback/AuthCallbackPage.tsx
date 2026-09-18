'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from 'convex/react';
import {
  useAccountState,
  type AccountState,
  type ClerkAccountState,
} from '@/lib/account';
import { AccountsUnavailable } from '@/components/AccountsUnavailable';
import { api } from '@/convex/_generated/api';
import { clearGuestSession, getExistingGuestSession } from '@/lib/guestSession';
import { captureError } from '@/lib/error';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';

interface AuthCallbackRouter {
  replace(href: string): void;
}

export type MigrateGuestToUser = (args: {
  guestToken: string;
}) => Promise<void>;

export interface AuthCallbackPageDependencies {
  useRouter(): AuthCallbackRouter;
  useAccountState(): AccountState;
  useMigrateGuestToUser(): MigrateGuestToUser;
  getExistingGuestSession: typeof getExistingGuestSession;
  clearGuestSession: typeof clearGuestSession;
  captureError: typeof captureError;
}

function useDefaultMigrateGuestToUser(): MigrateGuestToUser {
  const migrateGuestToUser = useMutation(api.migrations.migrateGuestToUser);
  return async (args) => {
    await migrateGuestToUser(args);
  };
}

const defaultAuthCallbackPageDependencies: AuthCallbackPageDependencies = {
  useRouter,
  useAccountState,
  useMigrateGuestToUser: useDefaultMigrateGuestToUser,
  getExistingGuestSession,
  clearGuestSession,
  captureError,
};

interface AuthCallbackPageProps {
  dependencies?: AuthCallbackPageDependencies;
}

export function AuthCallbackPage({
  dependencies = defaultAuthCallbackPageDependencies,
}: AuthCallbackPageProps = {}) {
  const account = dependencies.useAccountState();
  if (account.kind === 'local') return <AccountsUnavailable />;
  return (
    <ConnectedAuthCallbackPage dependencies={dependencies} account={account} />
  );
}

function ConnectedAuthCallbackPage({
  dependencies,
  account,
}: {
  dependencies: AuthCallbackPageDependencies;
  account: ClerkAccountState;
}) {
  const router = dependencies.useRouter();
  const { isLoaded, user } = account;
  const isSignedIn = !!user;
  const {
    isLoading: isConvexAuthLoading,
    isAuthenticated: isConvexAuthenticated,
  } = account.convex;
  const migrateGuestToUser = dependencies.useMigrateGuestToUser();
  const hasRun = useRef(false);
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [retryCount, setRetryCount] = useState(0);

  const migrateGuestSession = useCallback(
    async (guestToken: string) => {
      await migrateGuestToUser({ guestToken });
      await dependencies.clearGuestSession().catch((error) => {
        dependencies.captureError(error, { operation: 'clearGuestSession' });
      });
      router.replace('/');
    },
    [dependencies, migrateGuestToUser, router]
  );

  useEffect(() => {
    if (!isLoaded || isConvexAuthLoading || hasRun.current) return;
    if (!isSignedIn) {
      hasRun.current = true;
      router.replace('/');
      return;
    }

    if (!isConvexAuthenticated) {
      hasRun.current = true;
      dependencies.captureError(
        new Error(
          'Signed-in user missing Convex auth session during migration'
        ),
        {
          operation: 'migrateGuestToUser',
          phase: 'convexAuthUnavailable',
        }
      );
      queueMicrotask(() => {
        setStatus('error');
      });
      return;
    }

    hasRun.current = true;
    void dependencies
      .getExistingGuestSession()
      .then((session) => {
        if (!session.token) {
          router.replace('/');
          return;
        }
        return migrateGuestSession(session.token);
      })
      .catch((error) => {
        dependencies.captureError(error, { operation: 'migrateGuestToUser' });
        setStatus('error');
      });
  }, [
    isLoaded,
    isSignedIn,
    isConvexAuthLoading,
    isConvexAuthenticated,
    migrateGuestSession,
    dependencies,
    router,
    retryCount,
  ]);

  const handleRetry = useCallback(() => {
    if (!isSignedIn) {
      router.replace('/');
      return;
    }

    setStatus('loading');
    hasRun.current = false;
    setRetryCount((count) => count + 1);
  }, [isSignedIn, router]);

  if (status === 'error') {
    return (
      <div className="flex items-center justify-center bg-[var(--color-surface)]">
        <div className="max-w-xl w-full space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-sans font-bold text-[var(--color-text-primary)]">
              Could not finish sign in
            </h1>
            <p className="text-[var(--color-text-secondary)] leading-relaxed">
              Your guest poems could not be added to your account.
            </p>
          </div>
          <Alert variant="error">
            Try again to finish signing in, or return home.
          </Alert>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={handleRetry}>Try again</Button>
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
      className="flex items-center justify-center bg-[var(--color-surface)] py-8"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex items-center gap-3 text-[var(--color-text-primary)]">
        <span
          className="h-5 w-5 motion-safe:animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-primary)]"
          aria-hidden="true"
        />
        <p className="text-lg font-sans text-[var(--color-text-primary)]">
          Completing sign in...
        </p>
      </div>
    </div>
  );
}
