'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useUser } from '../../lib/auth';
import { captureError } from '../../lib/error';
import { trackGameCreated } from '../../lib/analytics';
import { errorToFeedback } from '../../lib/errorFeedback';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import {
  LoadingState,
  LoadingMessages,
} from '../../components/ui/LoadingState';

export default function HostPage() {
  const router = useRouter();
  const { guestToken, isLoading } = useUser();
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
      const { code } = await createRoomMutation({
        displayName: name,
        guestToken: guestToken || undefined,
      });
      trackGameCreated();
      router.push(`/room/${code}`);
    } catch (err) {
      const feedback = errorToFeedback(err);
      setError(feedback.message);
      captureError(err as Error, { displayName: name, guestToken });
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)]">
        <LoadingState message={LoadingMessages.SETTING_UP_ROOM} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)] p-6 md:p-12 lg:p-20 flex flex-col">
      <div className="max-w-xl w-full">
        <h1 className="text-5xl md:text-6xl font-[var(--font-display)] mb-8">
          Host Session
        </h1>

        <div className="p-8 border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-lg)]">
          <form onSubmit={handleCreate} className="space-y-8">
            <div className="space-y-3">
              <label
                htmlFor="name"
                className="block text-sm font-medium text-[var(--color-text-secondary)] uppercase tracking-wide"
              >
                Host Identity
              </label>
              <Input
                id="name"
                placeholder="Enter your name..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
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
                disabled={!name.trim() || isSubmitting}
              >
                {isSubmitting ? 'One moment...' : 'Create Room'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
