'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useUser } from '../../lib/auth';
import { captureError } from '../../lib/error';
import { E2E_TEST_IDS } from '../../lib/e2eTestIds';
import { trackGameJoined } from '../../lib/analytics';
import { errorToFeedback } from '../../lib/errorFeedback';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { AuthErrorState } from '@/components/AuthErrorState';
import {
  LoadingState,
  LoadingMessages,
} from '../../components/ui/LoadingState';

function JoinForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { guestToken, isLoading, authError, retryAuth } = useUser();
  const joinRoomMutation = useMutation(api.rooms.joinRoom);

  const [code, setCode] = useState(
    () => searchParams.get('code')?.toUpperCase() || ''
  );
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !name) return;

    setIsSubmitting(true);
    setError('');

    const normalizedCode = code.replace(/\s/g, '');

    try {
      await joinRoomMutation({
        code: normalizedCode,
        displayName: name,
        guestToken: guestToken || undefined,
      });
      trackGameJoined({ roomCode: normalizedCode });
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
      <p className="text-xs font-mono uppercase tracking-[0.32em] text-text-muted mb-3 text-right">
        Join game
      </p>
      <h1 className="text-4xl md:text-6xl font-[var(--font-display)] leading-tight mb-8 text-right">
        Join Session
      </h1>

      <div className="p-8 border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-lg)]">
        <p className="mb-8 text-base leading-relaxed text-[var(--color-text-secondary)]">
          You&apos;ll add one hidden line at a time, then everyone reads the
          finished poems together.
        </p>
        <form onSubmit={handleJoin} className="space-y-8">
          <div className="space-y-3">
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
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={4}
              required
              autoFocus={!hasCode}
              inputMode="text"
              autoCapitalize="characters"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              className="uppercase tracking-[0.5em] text-center font-mono text-2xl h-16 bg-[var(--color-muted)] border-2"
            />
          </div>

          <div className="space-y-3">
            <label
              htmlFor="name"
              className="block text-sm font-medium text-[var(--color-text-secondary)] uppercase tracking-wide"
            >
              Your Name
            </label>
            <Input
              id="name"
              data-testid={E2E_TEST_IDS.joinNameInput}
              placeholder="Enter your name..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus={hasCode}
              autoCapitalize="words"
              autoComplete="off"
              className="text-lg h-14"
            />
          </div>

          {/* Thumb-zone on phones; settles inline on tablet/desktop */}
          <div className="fixed inset-x-0 bottom-0 p-6 space-y-4 bg-background/95 backdrop-blur-md border-t-2 border-primary/20 shadow-[var(--shadow-lg)] md:static md:p-0 md:pt-4 md:bg-transparent md:backdrop-blur-none md:border-0 md:shadow-none">
            {error && (
              <Alert variant="error" data-testid={E2E_TEST_IDS.joinErrorAlert}>
                {error}
              </Alert>
            )}

            <Button
              type="submit"
              data-testid={E2E_TEST_IDS.joinRoomButton}
              className="w-full text-lg h-14"
              disabled={!name.trim() || !code.trim() || isSubmitting}
            >
              {isSubmitting ? 'Authenticating...' : 'Enter Room'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <div className="min-h-screen bg-[var(--color-background)] p-6 pb-32 md:p-12 lg:p-20 flex flex-col">
      <Suspense fallback={<div>Loading...</div>}>
        <JoinForm />
      </Suspense>
    </div>
  );
}
