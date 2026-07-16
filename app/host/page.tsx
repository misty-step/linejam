'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useUser } from '../../lib/auth';
import { captureError } from '../../lib/error';
import { hashRoomId, trackGameCreated } from '../../lib/analytics';
import { errorToFeedback } from '../../lib/errorFeedback';
import { E2E_TEST_IDS } from '../../lib/e2eTestIds';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Alert } from '../../components/ui/Alert';
import { AuthErrorState } from '../../components/AuthErrorState';
import {
  LoadingState,
  LoadingMessages,
} from '../../components/ui/LoadingState';

export default function HostPage() {
  const router = useRouter();
  const { guestToken, isLoading, authError, retryAuth } = useUser();
  const createRoomMutation = useMutation(api.rooms.createRoom);
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    setIsSubmitting(true);
    setError(null); // Clear error before retry

    try {
      const { code, roomId } = await createRoomMutation({
        displayName: name,
        guestToken: guestToken || undefined,
      });
      trackGameCreated({
        roomIdHash: hashRoomId(roomId),
        cycle: 1,
        playerKind: 'human',
      });
      router.push(`/room/${code}`);
    } catch (err) {
      const feedback = errorToFeedback(err);
      setError(feedback.message);
      captureError(err as Error, { displayName: name, guestToken });
      setIsSubmitting(false);
    }
  };

  if (authError) {
    return <AuthErrorState message={authError} onRetry={retryAuth} />;
  }

  if (isLoading) {
    return (
      <div className="lj-game-frame lj-viewport-offset relative flex items-center justify-center bg-[var(--color-background)]">
        <LoadingState message={LoadingMessages.SETTING_UP_ROOM} />
      </div>
    );
  }

  return (
    <form
      onSubmit={handleCreate}
      className="lj-game-frame lj-viewport-offset relative flex min-h-0 flex-col overflow-hidden bg-[var(--color-background)]"
    >
      <div
        data-testid={E2E_TEST_IDS.hostScrollRegion}
        className="lj-safe-frame min-h-0 flex-1 overflow-y-auto [--lj-safe-frame-space:1.5rem] md:[--lj-safe-frame-space:3rem] lg:[--lj-safe-frame-space:5rem]"
      >
        <div className="w-full max-w-xl">
          <p className="mb-3 text-xs font-mono uppercase tracking-[0.32em] text-text-muted">
            New game
          </p>
          <h1 className="mb-8 break-words text-4xl font-[var(--font-display)] leading-tight md:text-6xl">
            Host Session
          </h1>

          <div className="border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-lg)] md:p-8">
            <div className="space-y-3">
              <label
                htmlFor="name"
                className="block text-sm font-medium text-[var(--color-text-secondary)] uppercase tracking-wide"
              >
                Host Identity
              </label>
              <Input
                id="name"
                data-testid={E2E_TEST_IDS.hostNameInput}
                placeholder="Enter your name..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
                className="text-lg h-14"
              />
            </div>
          </div>
        </div>
      </div>

      <div
        data-testid={E2E_TEST_IDS.hostActionZone}
        className="lj-safe-inline min-h-0 max-h-[50%] flex-[0_1_auto] overflow-y-auto border-t-2 border-primary/20 bg-background/95 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-lg)] backdrop-blur-md md:[--lj-safe-inline-space:3rem] lg:[--lj-safe-inline-space:5rem]"
      >
        <div className="w-full max-w-xl space-y-4">
          {error && (
            <Alert variant="error" data-testid={E2E_TEST_IDS.hostErrorAlert}>
              {error}
            </Alert>
          )}

          <Button
            type="submit"
            data-testid={E2E_TEST_IDS.hostCreateRoomButton}
            className="h-[56px] w-full min-w-0 px-[16px] text-[clamp(1rem,5vw,1.125rem)] md:h-14 md:px-6 md:text-lg"
            disabled={!name.trim() || isSubmitting}
          >
            {isSubmitting ? 'One moment...' : 'Create Room'}
          </Button>
        </div>
      </div>
    </form>
  );
}
