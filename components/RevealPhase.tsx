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

import { LoadingState, LoadingMessages } from './ui/LoadingState';

import { Avatar } from './ui/Avatar';

import { BotBadge } from './ui/BotBadge';

import { Id } from '../convex/_generated/dataModel';

interface RevealPhaseProps {
  roomCode: string;
}

export function RevealPhase({ roomCode }: RevealPhaseProps) {
  const { guestToken } = useUser();

  const [showingPoemId, setShowingPoemId] = useState<Id<'poems'> | null>(null);

  const [isRevealingId, setIsRevealingId] = useState<Id<'poems'> | null>(null);

  const [error, setError] = useState<string | null>(null);

  const state = useQuery(api.game.getRevealPhaseState, {
    roomCode,

    guestToken: guestToken || undefined,
  });

  const revealPoemMutation = useMutation(api.game.revealPoem);

  const startNewCycleMutation = useMutation(api.game.startNewCycle);

  const handleReveal = async (poemId: Id<'poems'>) => {
    setIsRevealingId(poemId);
    setError(null); // Clear error before retry

    try {
      await revealPoemMutation({
        poemId,
        guestToken: guestToken || undefined,
      });

      setShowingPoemId(poemId);
    } catch (err) {
      const feedback = errorToFeedback(err);
      setError(feedback.message);
      captureError(err, { roomCode });
    } finally {
      setIsRevealingId(null);
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingState message={LoadingMessages.UNSEALING_POEMS} />
      </div>
    );

  const { myPoems, allRevealed, isHost, poems } = state;

  // For unique avatar colors
  const allStableIds = poems.map((p) => p.readerStableId);

  // Find the poem being displayed (if any)
  const displayingPoem = showingPoemId
    ? myPoems?.find((p) => p._id === showingPoemId)
    : null;

  // If showing the full poem after reveal
  if (displayingPoem) {
    return (
      <PoemDisplay
        poemId={displayingPoem._id}
        lines={displayingPoem.lines.map((l) => ({
          text: l.text,
          authorName: l.authorName,
          isBot: l.isBot,
        }))}
        onDone={() => setShowingPoemId(null)}
        alreadyRevealed={displayingPoem.isRevealed}
        showAttribution={true}
      />
    );
  }

  // Main reveal phase UI

  return (
    <div className="min-h-screen bg-background p-6 md:p-12 lg:p-24 flex flex-col md:flex-row gap-12 md:gap-24">
      {/* Left: Status Manifest */}
      <div className="md:w-1/3 space-y-8">
        <div className="space-y-4">
          <h1 className="text-4xl md:text-5xl font-[var(--font-display)] leading-[0.9]">
            {allRevealed ? 'Session\nComplete' : 'Reading\nPhase'}
          </h1>
          <p className="text-lg text-text-secondary leading-relaxed">
            {allRevealed
              ? 'The cycle is finished. The poems are sealed.'
              : 'One by one, unveil the hidden works. Read aloud with conviction.'}
          </p>
        </div>

        <div className="border-t border-border pt-8">
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
                      ? 'bg-muted border-transparent opacity-60'
                      : 'bg-surface border-border')
                  }
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-text-muted w-6">
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
                      (poem.isRevealed ? 'text-success' : 'text-text-muted')
                    }
                  >
                    {poem.isRevealed ? '✓' : '·'}
                  </span>
                </div>
              ))}
          </div>
        </div>

        {allRevealed && (
          <div className="pt-8 border-t border-border space-y-4">
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
              className="block text-center text-sm font-mono uppercase tracking-widest text-text-muted hover:underline mt-6"
            >
              Exit Room
            </Link>
          </div>
        )}
      </div>

      {/* Right: My Poems (Primary Focus) */}
      <div className="md:w-2/3 space-y-6">
        {myPoems && myPoems.length > 0 && (
          <>
            {/* Unrevealed poems - show as actionable cards */}
            {myPoems
              .filter((poem) => !poem.isRevealed)
              .map((poem) => (
                <div
                  key={poem._id}
                  className="p-12 border border-primary bg-surface shadow-lg space-y-8"
                >
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <p className="text-sm font-mono uppercase tracking-widest text-primary">
                        {poem.isForAi
                          ? `Read for ${poem.aiPersonaName}`
                          : 'Your Assignment'}
                      </p>
                      {poem.isForAi && <BotBadge />}
                    </div>
                    <p className="text-3xl font-[var(--font-display)] italic leading-relaxed">
                      &ldquo;{poem.preview}...&rdquo;
                    </p>
                  </div>
                  {error && <Alert variant="error">{error}</Alert>}
                  <Button
                    onClick={() => handleReveal(poem._id)}
                    size="lg"
                    className="w-full text-lg h-16"
                    disabled={isRevealingId === poem._id}
                  >
                    {isRevealingId === poem._id
                      ? 'Unsealing...'
                      : 'Reveal & Read'}
                  </Button>
                </div>
              ))}

            {/* Revealed poems - show as re-read buttons */}
            {myPoems
              .filter((poem) => poem.isRevealed)
              .map((poem) => (
                <Button
                  key={poem._id}
                  onClick={() => setShowingPoemId(poem._id)}
                  variant="outline"
                  size="lg"
                  className="w-full text-xl h-20 border-2"
                >
                  <span className="flex items-center gap-3">
                    {poem.isForAi ? (
                      <>
                        Re-Read {poem.aiPersonaName}&apos;s Poem
                        <BotBadge showLabel={false} />
                      </>
                    ) : (
                      'Re-Read My Poem'
                    )}
                  </span>
                </Button>
              ))}
          </>
        )}
      </div>
    </div>
  );
}
