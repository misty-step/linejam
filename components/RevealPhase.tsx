'use client';

import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { useUser } from '../lib/auth';
import { logger } from '../lib/logger';
import { Button } from './ui/Button';
import { Card, CardContent } from './ui/Card';
import { PoemDisplay } from './PoemDisplay';
import Link from 'next/link';
import { Id } from '../convex/_generated/dataModel';

interface RevealPhaseProps {
  roomCode: string;
}

export function RevealPhase({ roomCode }: RevealPhaseProps) {
  const { guestId } = useUser();
  const revealState = useQuery(api.game.getRevealPhaseState, {
    roomCode,
    guestId: guestId || undefined,
  });
  const revealPoem = useMutation(api.game.revealPoem);

  const [isRevealing, setIsRevealing] = useState(false);
  const [showingPoem, setShowingPoem] = useState(false);

  if (!revealState) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)]">
        <span className="text-[var(--color-text-muted)]">Loading...</span>
      </div>
    );
  }

  const { myPoem, poems, allRevealed, isHost } = revealState;

  const handleReveal = async () => {
    if (!myPoem) return;
    setIsRevealing(true);
    try {
      await revealPoem({
        poemId: myPoem._id as Id<'poems'>,
        guestId: guestId || undefined,
      });
      setShowingPoem(true);
    } catch (error) {
      logger.error(
        { error, roomCode, poemId: myPoem._id },
        'Failed to reveal poem'
      );
    }
    setIsRevealing(false);
  };

  // If showing the full poem after reveal
  if (showingPoem && myPoem) {
    return (
      <PoemDisplay
        poemNumber={myPoem.indexInRoom + 1}
        lines={myPoem.lines.map((l) => l.text)}
        onDone={() => setShowingPoem(false)}
      />
    );
  }

  // Main reveal phase UI
  return (
    <div className="min-h-screen bg-[var(--color-background)] p-6 flex flex-col">
      <div className="max-w-md mx-auto w-full flex-1 flex flex-col">
        {/* Header */}
        <div className="text-center space-y-3 mb-8">
          <h1 className="text-3xl sm:text-4xl tracking-tight">
            {allRevealed ? 'All Poems Read' : 'Time to Read'}
          </h1>
          <p className="text-[var(--color-text-secondary)]">
            {allRevealed
              ? 'Great game!'
              : 'Each player reveals and reads their poem aloud.'}
          </p>
        </div>

        {/* My Poem Card */}
        {myPoem && !myPoem.isRevealed && (
          <Card className="mb-8 animate-fade-in">
            <CardContent className="p-6 text-center space-y-4">
              <p className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
                Your poem to read
              </p>
              <p className="text-xl font-[var(--font-display)] italic text-[var(--color-text-primary)]">
                &ldquo;{myPoem.preview}...&rdquo;
              </p>
              <Button
                onClick={handleReveal}
                size="lg"
                className="w-full"
                disabled={isRevealing}
              >
                {isRevealing ? 'Revealing...' : 'Reveal & Read'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Already revealed message */}
        {myPoem && myPoem.isRevealed && !showingPoem && (
          <Card className="mb-8">
            <CardContent className="p-6 text-center space-y-4">
              <p className="text-[var(--color-text-muted)]">
                You&apos;ve read your poem
              </p>
              <Button
                onClick={() => setShowingPoem(true)}
                variant="secondary"
                size="lg"
                className="w-full"
              >
                View Again
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Progress */}
        <div className="space-y-3 mb-8">
          <p className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
            Progress
          </p>
          <div className="space-y-2">
            {poems
              .sort((a, b) => a.indexInRoom - b.indexInRoom)
              .map((poem) => (
                <div
                  key={poem._id}
                  className="flex items-center justify-between bg-[var(--color-surface)] border border-[var(--color-border)] px-4 py-3 rounded-[var(--radius-md)]"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        poem.isRevealed
                          ? 'bg-[var(--color-success)]'
                          : 'bg-[var(--color-border)]'
                      }`}
                    />
                    <span className="text-sm text-[var(--color-text-primary)]">
                      {poem.readerName}
                    </span>
                  </div>
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {poem.isRevealed ? 'Read' : 'Waiting'}
                  </span>
                </div>
              ))}
          </div>
        </div>

        {/* Host Controls */}
        {allRevealed && isHost && (
          <div className="space-y-3 mt-auto">
            <Button size="lg" className="w-full">
              Play Again
            </Button>
            <Link href="/me/poems" className="block">
              <Button variant="secondary" size="lg" className="w-full">
                View Collection
              </Button>
            </Link>
          </div>
        )}

        {/* Non-host after all revealed */}
        {allRevealed && !isHost && (
          <div className="space-y-3 mt-auto">
            <p className="text-center text-sm text-[var(--color-text-muted)]">
              Waiting for host...
            </p>
            <Link href="/me/poems" className="block">
              <Button variant="secondary" size="lg" className="w-full">
                View Collection
              </Button>
            </Link>
          </div>
        )}

        {/* Exit link */}
        <div className="text-center mt-6">
          <Link
            href="/"
            className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors duration-[var(--duration-fast)]"
          >
            Exit to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
