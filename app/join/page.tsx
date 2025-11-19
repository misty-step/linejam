'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useUser } from '../../lib/auth';
import { logger } from '../../lib/logger';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../components/ui/Card';

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
      logger.error(
        { error: err, roomCode: code.toUpperCase() },
        'Failed to join room'
      );
      setError(err instanceof Error ? err.message : 'Failed to join room');
      setIsJoining(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)]">
        <span className="text-[var(--color-text-muted)]">Loading...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-background)] p-6">
      <Card className="w-full max-w-sm animate-fade-in">
        <CardHeader>
          <CardTitle>Join a Game</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleJoin} className="space-y-5">
            <div className="space-y-2">
              <label
                htmlFor="code"
                className="text-sm font-medium text-[var(--color-text-secondary)]"
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
                className="uppercase tracking-widest text-center font-mono"
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="name"
                className="text-sm font-medium text-[var(--color-text-secondary)]"
              >
                Your Name
              </label>
              <Input
                id="name"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            {error && (
              <p className="text-sm text-[var(--color-error)]">{error}</p>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={!name.trim() || !code.trim() || isJoining}
            >
              {isJoining ? 'Joining...' : 'Join Game'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
