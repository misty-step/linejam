'use client';

import { Suspense, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useUser } from '../../lib/auth';
import { admitToRoom } from '../../lib/joinAdmission';
import { Brand } from '../../components/Brand';
import { AuthErrorState } from '../../components/AuthErrorState';
import { EntryIsland } from '../../components/EntryIsland';
import {
  LoadingState,
  LoadingMessages,
} from '../../components/ui/LoadingState';
import { ColorModeControl } from '../../components/ColorModeControl';
import { SoundControl } from '../../components/SoundControl';

function JoinForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useUser();
  const joinRoom = useMutation(api.rooms.joinRoom);
  const ready = !user.isLoading && !user.authError;
  const current = useRef(user);
  // Keep the current identity at the service boundary, never in DOM attributes.
  useEffect(() => {
    current.current = user;
  }, [user]);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return (
    <>
      {user.authError ? (
        <AuthErrorState message={user.authError} onRetry={user.retryAuth} />
      ) : user.isLoading ? (
        <div className="flex min-h-48 items-center justify-center">
          <LoadingState message={LoadingMessages.JOINING_SESSION} />
        </div>
      ) : null}
      <div style={{ display: ready ? undefined : 'none' }}>
        <EntryIsland
          kind="join"
          code={searchParams.get('code') || ''}
          ready={ready}
          onSubmit={({ resolve, ...input }) => {
            const identity = user;
            void admitToRoom(
              joinRoom,
              input,
              identity.guestToken,
              () =>
                mounted.current &&
                !current.current.isLoading &&
                !current.current.authError &&
                current.current.guestToken === identity.guestToken &&
                current.current.clerkUser?.id === identity.clerkUser?.id,
              (href) => router.push(href)
            ).then(resolve);
          }}
        />
      </div>
    </>
  );
}

export function JoinPage() {
  return (
    <div className="lj-game-frame lj-viewport-offset relative min-h-0 overflow-hidden bg-[var(--color-background)]">
      <div className="lj-safe-frame h-full overflow-y-auto [--lj-safe-frame-space:1rem] sm:[--lj-safe-frame-space:2rem]">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/"
              aria-label="Linejam home"
              className="inline-flex min-h-11 min-w-0 items-center rounded-[var(--radius-sm)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2"
            >
              <Brand className="text-2xl" />
            </Link>
            <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
              <ColorModeControl />
              <SoundControl />
            </div>
          </div>
          <Suspense
            fallback={
              <LoadingState message={LoadingMessages.JOINING_SESSION} />
            }
          >
            <JoinForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
