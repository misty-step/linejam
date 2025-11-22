'use client';

import { useState } from 'react';

import { useQuery, useMutation } from 'convex/react';

import { api } from '../convex/_generated/api';

import { useUser } from '../lib/auth';

import { captureError } from '../lib/error';

import { Button } from './ui/Button';

import { PoemDisplay } from './PoemDisplay';

import Link from 'next/link';

import { RoomQr } from './RoomQr';

interface RevealPhaseProps {
  roomCode: string;
}

export function RevealPhase({ roomCode }: RevealPhaseProps) {
  const { guestToken } = useUser();

  const [showingPoem, setShowingPoem] = useState(false);

  const [isRevealing, setIsRevealing] = useState(false);

  const state = useQuery(api.game.getRevealPhaseState, {
    roomCode,

    guestToken: guestToken || undefined,
  });

  const revealPoemMutation = useMutation(api.game.revealPoem);

  const startNewCycleMutation = useMutation(api.game.startNewCycle);

  const handleReveal = async () => {
    if (!state?.myPoem) return;

    setIsRevealing(true);

    try {
      await revealPoemMutation({
        poemId: state.myPoem._id,

        guestToken: guestToken || undefined,
      });

      setShowingPoem(true);
    } catch (error) {
      console.error('Failed to reveal poem:', error);

      captureError(error, { roomCode });
    } finally {
      setIsRevealing(false);
    }
  };

  const handleStartNewCycle = async () => {
    try {
      await startNewCycleMutation({
        roomCode,

        guestToken: guestToken || undefined,
      });

      // The page will automatically transition to Lobby due to query updates
    } catch (error) {
      console.error('Failed to start new cycle:', error);

      captureError(error, { roomCode });

      // You might want to show an error toast here
    }
  };

  if (!state) return <div>Loading...</div>;

  const { myPoem, allRevealed, isHost, poems } = state;

  // If showing the full poem after reveal

  if (showingPoem && myPoem) {
    return (
      <PoemDisplay
        poemNumber={myPoem.indexInRoom + 1}
        lines={myPoem.lines.map((l) => l.text)}
        onDone={() => setShowingPoem(false)}
        alreadyRevealed={myPoem.isRevealed}
      />
    );
  }

  // Main reveal phase UI

  return (
    <div className="min-h-screen bg-[var(--color-background)] p-6 md:p-12 lg:p-24 flex flex-col md:flex-row gap-12 md:gap-24">
      {/* Left: Status & Instructions */}

      <div className="md:w-1/3 space-y-12">
        <div className="space-y-4">
          <h1 className="text-5xl md:text-6xl font-[var(--font-display)] leading-[0.9]">
            {allRevealed ? 'Session\nComplete' : 'Reading\nPhase'}
          </h1>

          <p className="text-xl text-[var(--color-text-secondary)] leading-relaxed">
            {allRevealed
              ? 'The cycle is finished. The poems are sealed.'
              : 'One by one, unveil the hidden works. Read aloud with conviction.'}
          </p>
        </div>

        {/* My Poem Action */}

        {myPoem && !myPoem.isRevealed && (
          <div className="p-8 border-2 border-[var(--color-primary)] bg-[var(--color-surface)] shadow-[var(--shadow-lg)] space-y-6">
            <div>
              <p className="text-xs uppercase tracking-widest text-[var(--color-primary)] mb-2">
                Your Assignment
              </p>

              <p className="text-2xl font-[var(--font-display)] italic">
                &ldquo;{myPoem.preview}...&rdquo;
              </p>
            </div>

            <Button
              onClick={handleReveal}
              size="lg"
              className="w-full text-lg h-14"
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
            className="w-full text-lg h-14 border-2"
          >
            Re-Read My Poem
          </Button>
        )}

        {/* Host Actions */}

        {allRevealed && (
          <div className="pt-8 border-t border-[var(--color-border)] space-y-4">
            {isHost && (
              <Button
                onClick={handleStartNewCycle}
                size="lg"
                className="w-full h-14"
              >
                Start New Cycle
              </Button>
            )}

            <Link href="/me/poems" className="block">
              <Button variant="secondary" size="lg" className="w-full h-14">
                Archive
              </Button>
            </Link>

            <Link
              href="/"
              className="block text-center text-sm font-mono uppercase tracking-widest text-[var(--color-text-muted)] hover:text-[var(--color-primary)] mt-6"
            >
              Exit Room
            </Link>

            <div className="pt-8">
              <p className="text-center text-xs font-mono uppercase tracking-widest text-[var(--color-text-muted)] mb-4">
                Invite for Next Cycle
              </p>

              <RoomQr roomCode={roomCode} />
            </div>
          </div>
        )}
      </div>

      {/* Right: Manifest/Status */}

      <div className="md:w-2/3 max-w-xl">
        <div className="mb-8 pb-4 border-b border-[var(--color-border)]">
          <h3 className="font-mono uppercase tracking-widest">Poem Status</h3>
        </div>

        <div className="space-y-4">
          {poems

            .sort((a, b) => a.indexInRoom - b.indexInRoom)

            .map((poem, i) => (
              <div
                key={poem._id}
                className={
                  `flex items-center justify-between p-4 border ` +
                  (poem.isRevealed
                    ? 'bg-[var(--color-muted)] border-transparent opacity-60'
                    : 'bg-[var(--color-surface)] border-[var(--color-border)] shadow-[var(--shadow-sm)]')
                }
              >
                <div className="flex items-center gap-4">
                  <span className="font-mono text-[var(--color-text-muted)] w-8">
                    {(i + 1).toString().padStart(2, '0')}
                  </span>

                  <span className="text-lg font-medium">{poem.readerName}</span>
                </div>

                <span
                  className={
                    `text-xs font-mono uppercase tracking-wider px-2 py-1 ` +
                    (poem.isRevealed
                      ? 'text-[var(--color-success)] border border-[var(--color-success)]'
                      : 'text-[var(--color-text-muted)] border border-[var(--color-border-subtle)]')
                  }
                >
                  {poem.isRevealed ? 'Read' : 'Pending'}
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
