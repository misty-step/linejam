'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useUser } from '../../lib/auth';
import { captureError } from '../../lib/error';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import Link from 'next/link';

export default function HostPage() {
  const router = useRouter();
  const { guestToken, isLoading } = useUser();
  const createRoomMutation = useMutation(api.rooms.createRoom);
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    setIsSubmitting(true);

    try {
      const { code } = await createRoomMutation({
        displayName: name,
        guestToken: guestToken || undefined,
      });
      router.push(`/room/${code}`);
    } catch (err) {
      console.error(err);
      // Could show toast here
      captureError(err as Error, { displayName: name, guestToken });
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return null; // Minimal loader
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)] p-6 md:p-12 lg:p-20 flex flex-col">
      <Link
        href="/"
        className="mb-12 text-sm font-mono uppercase tracking-widest text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors w-fit"
      >
        ← Return Home
      </Link>

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
