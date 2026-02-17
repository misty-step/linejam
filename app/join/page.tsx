'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useUser } from '../../lib/auth';
import { captureError } from '../../lib/error';
import { trackGameJoined } from '../../lib/analytics';
import { errorToFeedback } from '../../lib/errorFeedback';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
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
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-background)] gap-4">
        <Alert variant="error">{authError}</Alert>
        <Button onClick={retryAuth}>Try again</Button>
      </div>
    );
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
      <h1 className="text-5xl md:text-6xl font-[var(--font-display)] mb-8 text-right">
        Join Session
      </h1>

      <div className="p-8 border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-lg)]">
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
              placeholder="ABCD"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={4}
              required
              autoFocus={!hasCode}
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
              placeholder="Enter your name..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus={hasCode}
              className="text-lg h-14"
            />
          </div>

          {error && (
            <Alert variant="error" className="mt-4">
              {error}
            </Alert>
          )}

          <div className="pt-4">
            <Button
              type="submit"
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
    <div className="min-h-screen bg-[var(--color-background)] p-6 md:p-12 lg:p-20 flex flex-col">
      <Suspense fallback={<div>Loading...</div>}>
        <JoinForm />
      </Suspense>
    </div>
  );
}
