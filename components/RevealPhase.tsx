'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { useUser } from '../lib/auth';
import { cn } from '../lib/utils';
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
import { trackGameCompleted } from '../lib/analytics';

interface RevealPhaseProps {
  roomCode: string;
}

export function RevealPhase({ roomCode }: RevealPhaseProps) {
  const { guestToken } = useUser();
  const [showingPoemId, setShowingPoemId] = useState<Id<'poems'> | null>(null);
  const [isRevealingId, setIsRevealingId] = useState<Id<'poems'> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStartingNow, setIsStartingNow] = useState(false);

  const state = useQuery(api.game.getRevealPhaseState, {
    roomCode,
    guestToken: guestToken || undefined,
  });

  const revealPoemMutation = useMutation(api.game.revealPoem);
  const startNewCycleMutation = useMutation(api.game.startNewCycle);
  const startGameMutation = useMutation(api.game.startGame);

  // Track game completion once when all poems are revealed
  const hasTrackedCompletion = useRef(false);
  useEffect(() => {
    if (!state) return;
    const { allRevealed, poems, myPoems } = state;
    const allStableIds = poems.map((p) => p.readerStableId);

    if (allRevealed && !hasTrackedCompletion.current) {
      hasTrackedCompletion.current = true;
      const hasAi = poems.some((p) =>
        myPoems?.find((mp) => mp._id === p._id)?.lines.some((l) => l.isBot)
      );
      trackGameCompleted({
        playerCount: allStableIds.length,
        poemCount: poems.length,
        hasAi: hasAi ?? false,
      });
    }
  }, [state]);

  const handleStartNow = async () => {
    setError(null);
    setIsStartingNow(true);

    try {
      await startGameMutation({
        code: roomCode,
        guestToken: guestToken || undefined,
      });
    } catch (err) {
      const feedback = errorToFeedback(err);
      setError(feedback.message);
      captureError(err, { roomCode });
    } finally {
      setIsStartingNow(false);
    }
  };

  const handleReveal = async (poemId: Id<'poems'>) => {
    setIsRevealingId(poemId);
    setError(null);

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
    setError(null);

    try {
      await startNewCycleMutation({
        roomCode,
        guestToken: guestToken || undefined,
      });
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
  const allStableIds = poems.map((p) => p.readerStableId);

  const displayingPoem = showingPoemId
    ? myPoems?.find((p) => p._id === showingPoemId)
    : null;

  if (displayingPoem) {
    // Count unique poets for this poem
    const uniquePoets = new Set(displayingPoem.lines.map((l) => l.authorName))
      .size;

    return (
      <PoemDisplay
        poemId={displayingPoem._id}
        lines={displayingPoem.lines.map((l) => ({
          text: l.text,
          authorName: l.authorName,
          authorStableId: l.authorStableId,
          isBot: l.isBot,
        }))}
        onDone={() => setShowingPoemId(null)}
        alreadyRevealed={displayingPoem.isRevealed}
        allStableIds={allStableIds}
        metadata={{
          createdAt: displayingPoem.createdAt,
          firstLine: displayingPoem.preview,
          uniquePoets,
        }}
      />
    );
  }

  // Single-column editorial layout
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="flex-1 p-6 md:p-12 lg:p-24 max-w-3xl mx-auto w-full space-y-12">
        {/* 1. HEADER - Context first */}
        <header className="space-y-4">
          <h1 className="text-3xl md:text-4xl font-[var(--font-display)] leading-[0.9]">
            {allRevealed ? 'Session Complete' : 'Reading Phase'}
          </h1>
          <p className="text-lg text-text-secondary leading-relaxed">
            {allRevealed
              ? 'The cycle is finished. The poems are sealed.'
              : 'One by one, unveil the hidden works. Read aloud with conviction.'}
          </p>
          <div className="border-t border-border" />
        </header>

        {/* 2. HERO - Your Assignment (primary action) */}
        {myPoems && myPoems.length > 0 && (
          <section className="space-y-6">
            {/* Unrevealed poems - actionable cards */}
            {myPoems
              .filter((poem) => !poem.isRevealed)
              .map((poem) => (
                <div
                  key={poem._id}
                  className="p-6 border border-primary bg-surface shadow-lg space-y-4"
                >
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <p className="text-xs font-mono uppercase tracking-widest text-primary">
                        {poem.isForAi
                          ? `Read for ${poem.aiPersonaName}`
                          : 'Your Assignment'}
                      </p>
                      {poem.isForAi && <BotBadge />}
                    </div>
                    <p className="text-xl md:text-2xl font-[var(--font-display)] italic leading-relaxed">
                      &ldquo;{poem.preview}...&rdquo;
                    </p>
                  </div>
                  {error && <Alert variant="error">{error}</Alert>}
                  <Button
                    onClick={() => handleReveal(poem._id)}
                    size="lg"
                    className="w-full h-12"
                    disabled={isRevealingId === poem._id}
                  >
                    {isRevealingId === poem._id
                      ? 'Unsealing...'
                      : 'Reveal & Read'}
                  </Button>
                </div>
              ))}

            {/* Revealed poems - re-read buttons */}
            {myPoems
              .filter((poem) => poem.isRevealed)
              .map((poem) => (
                <Button
                  key={poem._id}
                  onClick={() => setShowingPoemId(poem._id)}
                  variant="outline"
                  size="lg"
                  className="w-full text-lg h-16 border-2"
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
          </section>
        )}

        {/* 3. STATUS - Poem Status list */}
        <section className="space-y-4">
          <Label className="block">Poem Status</Label>
          <div className="border-t border-border-subtle">
            {poems
              .sort((a, b) => a.indexInRoom - b.indexInRoom)
              .map((poem, i) => (
                <div
                  key={poem._id}
                  className="flex items-center justify-between py-3 border-b border-border-subtle"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-text-muted w-6">
                      {(i + 1).toString().padStart(2, '0')}
                    </span>
                    <Avatar
                      stableId={poem.readerStableId}
                      displayName={poem.readerName}
                      allStableIds={allStableIds}
                      size="sm"
                      outlined={!poem.isRevealed}
                    />
                    <span
                      className={cn(
                        'text-sm font-medium',
                        poem.isRevealed && 'opacity-50'
                      )}
                    >
                      {poem.readerName}
                    </span>
                  </div>
                  {poem.isRevealed && (
                    <span className="text-[10px] font-mono uppercase tracking-widest text-text-muted">
                      READ
                    </span>
                  )}
                </div>
              ))}
          </div>
        </section>

        {/* 4. ACTIONS - Host controls */}
        {allRevealed && (
          <section className="space-y-4 pt-8 border-t border-border">
            {error && <Alert variant="error">{error}</Alert>}

            {/* Host controls */}
            {isHost && (
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={handleStartNow}
                  size="lg"
                  className="h-14"
                  disabled={isStartingNow}
                >
                  {isStartingNow ? 'Starting...' : 'Start Next Round'}
                </Button>
                <Button
                  onClick={handleStartNewCycle}
                  variant="outline"
                  size="lg"
                  className="h-14"
                >
                  Back to Lobby
                </Button>
              </div>
            )}

            {/* Non-host message */}
            {!isHost && (
              <p className="text-sm text-text-muted text-center">
                Waiting for host to start the next round...
              </p>
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
          </section>
        )}
      </main>
    </div>
  );
}
