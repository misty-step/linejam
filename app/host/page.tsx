'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useUser } from '../../lib/auth';
import { captureError } from '../../lib/error';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../components/ui/Card';

export default function HostPage() {
  const { guestId, isLoading } = useUser();
  const createRoom = useMutation(api.rooms.createRoom);
  const router = useRouter();
  const [name, setName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsCreating(true);
    try {
      const { code } = await createRoom({
        displayName: name,
        guestId: guestId || undefined,
      });
      router.push(`/room/${code}`);
    } catch (error) {
      captureError(error);
      setIsCreating(false);
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
          <CardTitle>Host a Game</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-5">
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
                autoFocus
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={!name.trim() || isCreating}
            >
              {isCreating ? 'Creating...' : 'Create Room'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
