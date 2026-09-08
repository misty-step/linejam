'use client';

import { useRef, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useUser } from '../../lib/auth';
import { captureError } from '../../lib/error';
import { E2E_TEST_IDS } from '../../lib/e2eTestIds';
import { hashRoomId, trackGameJoined } from '../../lib/analytics';
import { errorToFeedback } from '../../lib/errorFeedback';
import { toErrorReportable } from '../../lib/errorCore';
import { getDefaultAvatarId, type AvatarId } from '../../lib/avatars';
import { Brand } from '../../components/Brand';
import { AvatarPicker } from '../../components/AvatarPicker';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { AuthErrorState } from '@/components/AuthErrorState';
import {
  LoadingState,
  LoadingMessages,
} from '../../components/ui/LoadingState';
import { FocusedEntryAppearance } from '../../components/FocusedEntryAppearance';

function normalizeRoomCode(value: string): string {
  return value
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase()
    .slice(0, 4);
}

interface JoinPageRouter {
  push(href: string): void;
}

interface JoinPageSearchParams {
  get(name: string): string | null;
}

interface JoinPageUserState {
  guestToken: string | null;
  isLoading: boolean;
  authError: string | null;
  retryAuth(): void;
}

export interface JoinRoomResult {
  _id: string;
  currentCycle?: number;
}

export type JoinRoom = (args: {
  code: string;
  displayName: string;
  avatarId: AvatarId;
  guestToken?: string;
}) => Promise<JoinRoomResult>;

function useDefaultJoinRoom(): JoinRoom {
  const joinRoom = useMutation(api.rooms.joinRoom);
  return async (args) => joinRoom(args);
}

function useDefaultJoinUser(): JoinPageUserState {
  const { guestToken, isLoading, authError, retryAuth } = useUser();
  return { guestToken, isLoading, authError, retryAuth };
}

export interface JoinPageDependencies {
  useRouter(): JoinPageRouter;
  useSearchParams(): JoinPageSearchParams;
  useUser(): JoinPageUserState;
  useJoinRoom(): JoinRoom;
}

const defaultJoinPageDependencies: JoinPageDependencies = {
  useRouter,
  useSearchParams,
  useUser: useDefaultJoinUser,
  useJoinRoom: useDefaultJoinRoom,
};

interface JoinPageProps {
  dependencies?: JoinPageDependencies;
}

function JoinForm({ dependencies }: { dependencies: JoinPageDependencies }) {
  const router = dependencies.useRouter();
  const searchParams = dependencies.useSearchParams();
  const { guestToken, isLoading, authError, retryAuth } =
    dependencies.useUser();
  const joinRoomMutation = dependencies.useJoinRoom();
  const nameInputRef = useRef<HTMLInputElement>(null);

  const [code, setCode] = useState(() =>
    normalizeRoomCode(searchParams.get('code') || '')
  );
  const [name, setName] = useState('');
  const [avatarId, setAvatarId] = useState<AvatarId>(() =>
    getDefaultAvatarId(guestToken || 'linejam-join')
  );
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedCode = normalizeRoomCode(code);
    const normalizedName = name.trim();
    if (!normalizedCode || !normalizedName) return;

    setIsSubmitting(true);
    setError('');

    try {
      const room = await joinRoomMutation({
        code: normalizedCode,
        displayName: normalizedName,
        avatarId,
        guestToken: guestToken || undefined,
      });
      trackGameJoined({
        roomIdHash: hashRoomId(room._id),
        cycle: room.currentCycle ?? 1,
      });
      router.push(`/room/${normalizedCode}`);
    } catch (cause) {
      const error = toErrorReportable(cause);
      const feedback = errorToFeedback(error);
      setError(feedback.message);
      captureError(error, { roomCode: normalizedCode });
      setIsSubmitting(false);
    }
  };

  if (authError) {
    return <AuthErrorState message={authError} onRetry={retryAuth} />;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-48 items-center justify-center">
        <LoadingState message={LoadingMessages.JOINING_SESSION} />
      </div>
    );
  }

  const hasCode = !!searchParams.get('code');

  return (
    <>
      <h1 className="mb-5 text-3xl font-sans font-bold leading-tight text-[var(--color-text-primary)]">
        Join room
      </h1>

      <form
        onSubmit={handleJoin}
        aria-label="Join room"
        className="space-y-5 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6"
      >
        <div className="space-y-2">
          <label
            htmlFor="code"
            className="block text-base font-semibold text-[var(--color-text-primary)]"
          >
            Room code
          </label>
          <Input
            id="code"
            name="roomCode"
            data-testid={E2E_TEST_IDS.joinRoomCodeInput}
            placeholder="ABCD"
            value={code}
            onChange={(e) => setCode(normalizeRoomCode(e.target.value))}
            maxLength={7}
            required
            autoFocus={!hasCode}
            inputMode="text"
            autoCapitalize="characters"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="next"
            disabled={isSubmitting}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                nameInputRef.current?.focus();
              }
            }}
            className="h-12 text-lg font-semibold uppercase tracking-[0.2em]"
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="name"
            className="block text-base font-semibold text-[var(--color-text-primary)]"
          >
            Your pen name
          </label>
          <Input
            ref={nameInputRef}
            id="name"
            name="displayName"
            data-testid={E2E_TEST_IDS.joinNameInput}
            placeholder="e.g. Alex"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus={hasCode}
            autoCapitalize="words"
            autoComplete="nickname"
            enterKeyHint="go"
            disabled={isSubmitting}
            className="h-12 text-base"
          />
        </div>

        <AvatarPicker
          value={avatarId}
          onChange={setAvatarId}
          disabled={isSubmitting}
        />

        <div className="space-y-4">
          {error && (
            <Alert variant="error" data-testid={E2E_TEST_IDS.joinErrorAlert}>
              {error}
            </Alert>
          )}

          <Button
            type="submit"
            data-testid={E2E_TEST_IDS.joinRoomButton}
            className="min-h-12 w-full text-base"
            disabled={!name.trim() || !code.trim() || isSubmitting}
          >
            {isSubmitting ? 'Joining room…' : 'Join room'}
          </Button>
        </div>
      </form>
    </>
  );
}

export function JoinPage({
  dependencies = defaultJoinPageDependencies,
}: JoinPageProps = {}) {
  return (
    <div className="lj-game-frame lj-viewport-offset relative min-h-0 overflow-hidden bg-[var(--color-background)]">
      <div className="lj-safe-frame h-full overflow-y-auto [--lj-safe-frame-space:1rem] sm:[--lj-safe-frame-space:2rem]">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/"
              aria-label="Linejam home"
              className="inline-flex min-h-11 min-w-0 items-center rounded-[var(--radius-sm)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2"
            >
              <Brand className="text-2xl" />
            </Link>
            <FocusedEntryAppearance className="ml-auto" />
          </div>
          <Suspense
            fallback={
              <LoadingState message={LoadingMessages.JOINING_SESSION} />
            }
          >
            <JoinForm dependencies={dependencies} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
