'use client';

import { useRef, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useUser } from '../../lib/auth';
import { captureError } from '../../lib/error';
import { E2E_TEST_IDS } from '../../lib/e2eTestIds';
import { hashRoomId, trackGameJoined } from '../../lib/analytics';
import { errorToFeedback } from '../../lib/errorFeedback';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { AuthErrorState } from '@/components/AuthErrorState';
import {
  LoadingState,
  LoadingMessages,
} from '../../components/ui/LoadingState';

function normalizeRoomCode(value: string): string {
  return value
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase()
    .slice(0, 4);
}

function JoinForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { guestToken, isLoading, authError, retryAuth } = useUser();
  const joinRoomMutation = useMutation(api.rooms.joinRoom);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const [code, setCode] = useState(() =>
    normalizeRoomCode(searchParams.get('code') || '')
  );
  const [name, setName] = useState('');
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
        guestToken: guestToken || undefined,
      });
      trackGameJoined({
        roomIdHash: hashRoomId(room._id),
        cycle: room.currentCycle ?? 1,
        playerKind: 'human',
      });
      router.push(`/room/${normalizedCode}`);
    } catch (err) {
      const feedback = errorToFeedback(err);
      setError(feedback.message);
      captureError(err, { roomCode: normalizedCode });
      setIsSubmitting(false);
    }
  };

  if (authError) {
    return <AuthErrorState message={authError} onRetry={retryAuth} />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)]">
        <LoadingState message={LoadingMessages.JOINING_SESSION} />
      </div>
    );
  }

  const hasCode = !!searchParams.get('code');

  return (
    <div className="max-w-xl w-full ml-auto">
      <p className="text-xs font-mono uppercase tracking-[0.32em] text-text-muted mb-2 sm:mb-3 text-right">
        Join game
      </p>
      <h1 className="text-3xl sm:text-4xl md:text-6xl font-[var(--font-display)] leading-tight mb-5 sm:mb-8 text-right break-words">
        Join Session
      </h1>

      <div className="p-5 sm:p-8 border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-lg)]">
        <p className="mb-5 sm:mb-8 text-base leading-relaxed text-[var(--color-text-secondary)]">
          You&apos;ll add one hidden line at a time, then everyone reads the
          finished poems together.
        </p>
        {hasCode && (
          <p
            id="join-invite-hint"
            className="mb-5 text-sm text-[var(--color-text-secondary)]"
          >
            Invite link loaded. Enter your name to join room {code}.
          </p>
        )}
        <form onSubmit={handleJoin} className="space-y-5 sm:space-y-8">
          <div className="space-y-2 sm:space-y-3">
            <label
              htmlFor="code"
              className="block text-sm font-medium text-[var(--color-text-secondary)] uppercase tracking-wide"
            >
              Room Code
            </label>
            <Input
              id="code"
              data-testid={E2E_TEST_IDS.joinRoomCodeInput}
              placeholder="ABCD"
              value={code}
              onChange={(e) => setCode(normalizeRoomCode(e.target.value))}
              maxLength={7}
              readOnly={hasCode}
              aria-describedby={hasCode ? 'join-invite-hint' : undefined}
              required
              autoFocus={!hasCode}
              inputMode="text"
              autoCapitalize="characters"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="next"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  nameInputRef.current?.focus();
                }
              }}
              className="uppercase tracking-[0.35em] sm:tracking-[0.5em] text-center font-mono text-2xl h-14 sm:h-16 bg-[var(--color-muted)] border-2 scroll-mb-28"
            />
          </div>

          <div className="space-y-2 sm:space-y-3">
            <label
              htmlFor="name"
              className="block text-sm font-medium text-[var(--color-text-secondary)] uppercase tracking-wide"
            >
              Your Name
            </label>
            <Input
              ref={nameInputRef}
              id="name"
              data-testid={E2E_TEST_IDS.joinNameInput}
              placeholder="Enter your name..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus={hasCode}
              autoCapitalize="words"
              autoComplete="off"
              enterKeyHint="go"
              className="text-lg h-14 scroll-mb-28"
            />
          </div>

          <div className="pt-1 sm:pt-4 space-y-4">
            {error && (
              <Alert variant="error" data-testid={E2E_TEST_IDS.joinErrorAlert}>
                {error}
              </Alert>
            )}

            <Button
              type="submit"
              data-testid={E2E_TEST_IDS.joinRoomButton}
              className="w-full text-base sm:text-lg h-12 sm:h-14"
              disabled={!name.trim() || !code.trim() || isSubmitting}
            >
              {isSubmitting ? 'Joining...' : 'Enter Room'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <div className="min-h-screen w-full bg-[var(--color-background)] px-4 py-6 sm:p-6 md:p-12 lg:p-20 flex flex-col">
      <Suspense fallback={<div>Loading...</div>}>
        <JoinForm />
      </Suspense>
    </div>
  );
}
