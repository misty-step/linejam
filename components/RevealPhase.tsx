'use client';

import { useState } from 'react';

import { useQuery, useMutation } from 'convex/react';

import { api } from '../convex/_generated/api';

import { useUser } from '../lib/auth';

import { captureError } from '../lib/error';

import { errorToFeedback } from '../lib/errorFeedback';

import { Alert } from './ui/Alert';

import { Button } from './ui/Button';

import { Label } from './ui/Label';

import { PoemDisplay } from './PoemDisplay';

import Link from 'next/link';

import { RoomQr } from './RoomQr';

import { LoadingState, LoadingMessages } from './ui/LoadingState';

import { Avatar } from './ui/Avatar';

interface RevealPhaseProps {
  roomCode: string;
}

export function RevealPhase({ roomCode }: RevealPhaseProps) {
  const { guestToken } = useUser();

  const [showingPoem, setShowingPoem] = useState(false);

  const [isRevealing, setIsRevealing] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const state = useQuery(api.game.getRevealPhaseState, {
    roomCode,

    guestToken: guestToken || undefined,
  });

  const revealPoemMutation = useMutation(api.game.revealPoem);

  const startNewCycleMutation = useMutation(api.game.startNewCycle);

  const handleReveal = async () => {
    if (!state?.myPoem) return;

    setIsRevealing(true);
    setError(null); // Clear error before retry

    try {
      await revealPoemMutation({
        poemId: state.myPoem._id,

        guestToken: guestToken || undefined,
      });

      setShowingPoem(true);
    } catch (err) {
      const feedback = errorToFeedback(err);
      setError(feedback.message);
      captureError(err, { roomCode });
    } finally {
      setIsRevealing(false);
    }
  };

  const handleStartNewCycle = async () => {
    setError(null); // Clear error before retry

    try {
      await startNewCycleMutation({
        roomCode,

        guestToken: guestToken || undefined,
      });

      // The page will automatically transition to Lobby due to query updates
    } catch (err) {
      const feedback = errorToFeedback(err);
      setError(feedback.message);
      captureError(err, { roomCode });
    }
  };

  if (!state)
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)]">
        <LoadingState message={LoadingMessages.UNSEALING_POEMS} />
      </div>
    );

  const { myPoem, allRevealed, isHost, poems } = state;

  // For unique avatar colors
  const allStableIds = poems.map((p) => p.readerStableId);

  // If showing the full poem after reveal

  if (showingPoem && myPoem) {
    return (
      <PoemDisplay
        poemId={myPoem._id}
        lines={myPoem.lines.map((l) => l.text)}
        onDone={() => setShowingPoem(false)}
        alreadyRevealed={myPoem.isRevealed}
      />
    );
  }

  // Main reveal phase UI

  return (
    <div className="min-h-screen bg-[var(--color-background)] p-6 md:p-12 lg:p-24 flex flex-col md:flex-row gap-12 md:gap-24">
      {/* Left: Status Manifest */}
      <div className="md:w-1/3 space-y-8">
        <div className="space-y-4">
          <h1 className="text-4xl md:text-5xl font-[var(--font-display)] leading-[0.9]">
            {allRevealed ? 'Session\nComplete' : 'Reading\nPhase'}
          </h1>
          <p className="text-lg text-[var(--color-text-secondary)] leading-relaxed">
            {allRevealed
              ? 'The cycle is finished. The poems are sealed.'
              : 'One by one, unveil the hidden works. Read aloud with conviction.'}
          </p>
        </div>

        <div className="border-t border-[var(--color-border)] pt-8">
          <Label className="block mb-4">Poem Status</Label>
          <div className="space-y-2">
            {poems
              .sort((a, b) => a.indexInRoom - b.indexInRoom)
              .map((poem, i) => (
                <div
                  key={poem._id}
                  className={
                    `flex items-center justify-between p-3 border ` +
                    (poem.isRevealed
                      ? 'bg-[var(--color-muted)] border-transparent opacity-60'
                      : 'bg-[var(--color-surface)] border-[var(--color-border)]')
                  }
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-[var(--color-text-muted)] w-6">
                      {(i + 1).toString().padStart(2, '0')}
                    </span>
                    <Avatar
                      stableId={poem.readerStableId}
                      displayName={poem.readerName}
                      allStableIds={allStableIds}
                      size="xs"
                    />
                    <span className="text-sm font-medium">
                      {poem.readerName}
                    </span>
                  </div>
                  <span
                    className={
                      `text-xs font-mono uppercase tracking-wider px-2 py-1 ` +
                      (poem.isRevealed
                        ? 'text-[var(--color-success)]'
                        : 'text-[var(--color-text-muted)]')
                    }
                  >
                    {poem.isRevealed ? '✓' : '·'}
                  </span>
                </div>
              ))}
          </div>
        </div>

        {allRevealed && (
          <div className="pt-8 border-t border-[var(--color-border)] space-y-4">
            {error && <Alert variant="error">{error}</Alert>}
            {isHost && (
              <Button
                onClick={handleStartNewCycle}
                size="lg"
                className="w-full h-14"
              >
                New Round
              </Button>
            )}
            <Link href="/me/poems" className="block">
              <Button variant="secondary" size="lg" className="w-full h-14">
                Archive
              </Button>
            </Link>
            <Link
              href="/"
              className="block text-center text-sm font-mono uppercase tracking-widest text-[var(--color-text-muted)] hover:underline mt-6"
            >
              Exit Room
            </Link>
            <div className="pt-8">
              <Label className="text-center block mb-4">
                Invite for Next Cycle
              </Label>
              <RoomQr roomCode={roomCode} />
            </div>
          </div>
        )}
      </div>

      {/* Right: My Poem (Primary Focus) */}
      <div className="md:w-2/3">
        {myPoem && !myPoem.isRevealed && (
          <div className="p-12 border border-[var(--color-primary)] bg-[var(--color-surface)] shadow-[var(--shadow-lg)] space-y-8">
            <div>
              <p className="text-sm font-mono uppercase tracking-widest text-[var(--color-primary)] mb-4">
                Your Assignment
              </p>
              <p className="text-3xl font-[var(--font-display)] italic leading-relaxed">
                &ldquo;{myPoem.preview}...&rdquo;
              </p>
            </div>
            {error && <Alert variant="error">{error}</Alert>}
            <Button
              onClick={handleReveal}
              size="lg"
              className="w-full text-lg h-16"
              disabled={isRevealing}
            >
              {isRevealing ? 'Unsealing...' : 'Reveal & Read'}
            </Button>
          </div>
        )}

        {myPoem && myPoem.isRevealed && (
          <Button
            onClick={() => setShowingPoem(true)}
            variant="outline"
            size="lg"
            className="w-full text-xl h-20 border-2"
          >
            Re-Read My Poem
          </Button>
        )}
      </div>
    </div>
  );
}
