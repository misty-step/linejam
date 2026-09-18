'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useUser } from '../../lib/auth';
import { captureError } from '../../lib/error';
import { hashRoomId, trackGameCreated } from '../../lib/analytics';
import { errorToFeedback } from '../../lib/errorFeedback';
import { toErrorReportable } from '../../lib/errorCore';
import { E2E_TEST_IDS } from '../../lib/e2eTestIds';
import { playSound } from '@/lib/audio';
import {
  AVATAR_IDS,
  getRandomAvatarId,
  type AvatarId,
} from '../../lib/avatars';
import { Brand } from '../../components/Brand';
import { AvatarPicker } from '../../components/AvatarPicker';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Alert } from '../../components/ui/Alert';
import { AuthErrorState } from '../../components/AuthErrorState';
import {
  LoadingState,
  LoadingMessages,
} from '../../components/ui/LoadingState';
import { ColorModeControl } from '../../components/ColorModeControl';
import { SoundControl } from '../../components/SoundControl';

export default function HostPage() {
  const router = useRouter();
  const { guestToken, isLoading, authError, retryAuth } = useUser();
  const createRoomMutation = useMutation(api.rooms.createRoom);
  const [name, setName] = useState('');
  const [avatarId, setAvatarId] = useState<AvatarId>(AVATAR_IDS[0]);
  const initialAvatarRef = useRef<AvatarId | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initialAvatarRef.current ??= getRandomAvatarId();
    const initialAvatar = initialAvatarRef.current;
    let isStale = false;
    // Keep server and hydration markup identical; seed this attempt only once.
    queueMicrotask(() => {
      if (!isStale) setAvatarId(initialAvatar);
    });
    return () => {
      isStale = true;
    };
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const displayName = name.trim();
    if (!displayName) return;

    setIsSubmitting(true);
    setError(null); // Clear error before retry

    try {
      const { code, roomId } = await createRoomMutation({
        displayName,
        avatarId,
        guestToken: guestToken || undefined,
      });
      trackGameCreated({
        roomIdHash: hashRoomId(roomId),
        cycle: 1,
      });
      playSound('sparkle');
      router.push(`/room/${code}`);
    } catch (cause) {
      playSound('error');
      const error = toErrorReportable(cause);
      const feedback = errorToFeedback(error);
      setError(feedback.message);
      captureError(error, {
        displayName,
        guestToken,
      });
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
    <div className="lj-game-frame lj-viewport-offset relative min-h-0 overflow-hidden bg-[var(--color-background)]">
      <div
        data-testid={E2E_TEST_IDS.hostScrollRegion}
        className="lj-safe-frame h-full overflow-y-auto [--lj-safe-frame-space:1rem] sm:[--lj-safe-frame-space:2rem]"
      >
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
          <h1 className="mb-4 text-3xl font-sans font-bold leading-tight text-[var(--color-text-primary)]">
            Create room
          </h1>

          <form
            onSubmit={handleCreate}
            aria-label="Create room"
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <label
                htmlFor="name"
                className="block text-sm font-semibold text-[var(--color-text-primary)]"
              >
                Your pen name
              </label>
              <div className="flex items-center gap-3">
                <Input
                  id="name"
                  name="displayName"
                  data-testid={E2E_TEST_IDS.hostNameInput}
                  placeholder="e.g. Alex"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoFocus
                  autoCapitalize="words"
                  autoComplete="nickname"
                  enterKeyHint="go"
                  disabled={isSubmitting}
                  className="h-12 text-base"
                />
                <AvatarPicker
                  value={avatarId}
                  onChange={setAvatarId}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div
              data-testid={E2E_TEST_IDS.hostActionZone}
              className="space-y-4"
            >
              {error && (
                <Alert
                  variant="error"
                  data-testid={E2E_TEST_IDS.hostErrorAlert}
                >
                  {error}
                </Alert>
              )}

              <Button
                type="submit"
                data-testid={E2E_TEST_IDS.hostCreateRoomButton}
                data-sound="loading"
                className="min-h-12 w-full text-base"
                disabled={!name.trim() || isSubmitting}
              >
                {isSubmitting ? 'Creating room…' : 'Create room'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
