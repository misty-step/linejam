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

export default function JoinPage() {
  const { guestId, isLoading } = useUser();
  const joinRoom = useMutation(api.rooms.joinRoom);
  const router = useRouter();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) return;

    setIsJoining(true);
    setError('');
    try {
      await joinRoom({
        code: code.toUpperCase(),
        displayName: name,
        guestId: guestId || undefined,
      });
      router.push(`/room/${code.toUpperCase()}`);
    } catch (err) {
      captureError(err, { roomCode: code.toUpperCase() });
      setError(err instanceof Error ? err.message : 'Failed to join room');
      setIsJoining(false);
    }
  };

  if (isLoading) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)] p-6 md:p-12 lg:p-20 flex flex-col">
      <Link
        href="/"
        className="mb-12 text-sm font-mono uppercase tracking-widest text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors w-fit"
      >
        ← Return Home
      </Link>

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
                autoFocus
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
                className="text-lg h-14"
              />
            </div>

            {error && (
              <div className="p-3 border border-[var(--color-error)] bg-[var(--color-error)]/5 text-[var(--color-error)] text-sm">
                {error}
              </div>
            )}

            <div className="pt-4">
              <Button
                type="submit"
                className="w-full text-lg h-14"
                disabled={!name.trim() || !code.trim() || isJoining}
              >
                {isJoining ? 'Authenticating...' : 'Enter Room'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
