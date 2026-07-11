'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { useUser } from '../lib/auth';
import { cn } from '../lib/utils';
import { E2E_TEST_IDS } from '../lib/e2eTestIds';
import { captureError } from '../lib/error';
import { errorToFeedback } from '../lib/errorFeedback';
import { Alert } from './ui/Alert';
import { Button } from './ui/Button';
import { PoemDisplay } from './PoemDisplay';
import { LoadingState, LoadingMessages } from './ui/LoadingState';
import { Avatar } from './ui/Avatar';
import { BotBadge } from './ui/BotBadge';
import { Id } from '../convex/_generated/dataModel';
import { trackGameCompleted } from '../lib/analytics';
import { RoomChrome } from './RoomChrome';
import { buildRevealChromeCopy } from '../lib/roomChromeCopy';
import { SessionRecapHub } from './SessionRecapHub';
import { RevealStage } from './stage/RevealStage';
import { Presentation, Check } from 'lucide-react';

type ReadingCircleStatus = 'read' | 'reading-now' | 'up-next' | null;

const READING_CIRCLE_STATUS_LABEL: Record<
  Exclude<ReadingCircleStatus, null>,
  string
> = {
  read: 'Read',
  'reading-now': 'Reading now',
  'up-next': 'Up next',
};

interface RevealPhaseProps {
  roomCode: string;
  showChrome?: boolean;
}

export function RevealPhase({
  roomCode,
  showChrome = false,
}: RevealPhaseProps) {
  const { guestToken } = useUser();
  const [showingPoemId, setShowingPoemId] = useState<Id<'poems'> | null>(null);
  const [isRevealingId, setIsRevealingId] = useState<Id<'poems'> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStartingNow, setIsStartingNow] = useState(false);
  const [isPresenting, setIsPresenting] = useState(false);

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
    const { allRevealed, poems, players } = state;

    if (allRevealed && !hasTrackedCompletion.current) {
      hasTrackedCompletion.current = true;
      const hasAi = players.some((p) => p.isBot);
      trackGameCompleted({
        playerCount: players.length,
        poemCount: poems.length,
        hasAi,
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

  const revealPoem = async (
    poemId: Id<'poems'>,
    { showPoem }: { showPoem: boolean }
  ) => {
    setIsRevealingId(poemId);
    setError(null);

    try {
      await revealPoemMutation({
        poemId,
        guestToken: guestToken || undefined,
      });
      if (showPoem) {
        setShowingPoemId(poemId);
      }
    } catch (err) {
      const feedback = errorToFeedback(err);
      setError(feedback.message);
      captureError(err, { roomCode });
    } finally {
      setIsRevealingId(null);
    }
  };

  const handleReveal = async (poemId: Id<'poems'>) => {
    await revealPoem(poemId, { showPoem: true });
  };

  const handleStageReveal = async (poemId: Id<'poems'>) => {
    await revealPoem(poemId, { showPoem: false });
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

  const { myPoems, allRevealed, poems } = state;
  const allStableIds = poems.map((p) => p.readerStableId);

  const displayingPoem = showingPoemId
    ? myPoems?.find((p) => p._id === showingPoemId)
    : null;
  const chrome = showChrome ? (
    <RoomChrome
      roomCode={roomCode}
      {...buildRevealChromeCopy({ allRevealed })}
    />
  ) : null;

  if (displayingPoem) {
    // Count unique poets for this poem
    const uniquePoets = new Set(displayingPoem.lines.map((l) => l.authorName))
      .size;

    return (
      <>
        {chrome}
        <PoemDisplay
          poemId={displayingPoem._id}
          guestToken={guestToken || undefined}
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
      </>
    );
  }

  // Single-column editorial layout
  return (
    <>
      {chrome}
      {isPresenting && (
        <RevealStage
          poems={poems}
          myPoems={myPoems ?? []}
          revealedPoems={state.revealedPoems ?? []}
          allStableIds={allStableIds}
          error={error}
          isRevealingId={isRevealingId}
          onRevealPoem={handleStageReveal}
          onExit={() => setIsPresenting(false)}
        />
      )}
      <div
        data-testid={E2E_TEST_IDS.revealPhase}
        className="min-h-screen bg-background flex flex-col"
      >
        <main className="flex-1 max-w-3xl mx-auto w-full space-y-12 p-6 md:p-12 lg:px-24 lg:pb-24 lg:pt-16">
          {state.isHost && (
            <Button
              type="button"
              onClick={() => setIsPresenting(true)}
              data-testid={E2E_TEST_IDS.revealPresentationButton}
              variant="outline"
              size="md"
              className="w-full"
            >
              <Presentation className="mr-2 h-4 w-4" />
              Present reveal
            </Button>
          )}

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
                      data-testid={E2E_TEST_IDS.revealPoemButton}
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

          {/* 2b. THE READING CIRCLE - the running order, one row per reader,
              each carrying a status chip driven by reveal state. */}
          <section className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-2xl md:text-3xl font-[var(--font-display)] leading-tight text-text-primary">
                The reading circle
              </h2>
              <p className="text-sm text-text-muted">
                Everyone reads one poem aloud.
              </p>
            </div>
            <div className="border-t border-border-subtle">
              {(() => {
                const sortedPoems = [...poems].sort(
                  (a, b) => a.indexInRoom - b.indexInRoom
                );
                const unrevealed = sortedPoems.filter((p) => !p.isRevealed);
                const readingNowId = unrevealed[0]?._id;
                const upNextId = unrevealed[1]?._id;

                return sortedPoems.map((poem, i) => {
                  const status: ReadingCircleStatus = poem.isRevealed
                    ? 'read'
                    : poem._id === readingNowId
                      ? 'reading-now'
                      : poem._id === upNextId
                        ? 'up-next'
                        : null;

                  return (
                    <div
                      key={poem._id}
                      aria-current={
                        status === 'reading-now' ? 'true' : undefined
                      }
                      className={cn(
                        'flex items-center justify-between gap-3 py-3 px-3 -mx-3 border-b border-border-subtle transition-colors motion-reduce:transition-none',
                        status === 'reading-now' &&
                          'border-l-2 border-l-primary bg-primary/5'
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="w-6 shrink-0 font-mono text-xs text-text-muted">
                          {(i + 1).toString().padStart(2, '0')}
                        </span>
                        <Avatar
                          stableId={poem.readerStableId}
                          displayName={poem.readerName}
                          allStableIds={allStableIds}
                          size="sm"
                          outlined={!poem.isRevealed}
                        />
                        <div className="min-w-0">
                          <span
                            className={cn(
                              'block truncate text-sm font-medium text-text-primary',
                              poem.isRevealed && 'opacity-50'
                            )}
                          >
                            {poem.readerName}
                          </span>
                          <span className="block text-[10px] font-mono uppercase tracking-widest text-text-muted">
                            Poem {(i + 1).toString().padStart(2, '0')}
                          </span>
                        </div>
                      </div>
                      {status && (
                        <span
                          className={cn(
                            'inline-flex shrink-0 items-center gap-1 text-[10px] font-mono uppercase tracking-widest',
                            status === 'read' && 'text-text-muted opacity-50',
                            status === 'reading-now' && 'text-primary',
                            status === 'up-next' && 'text-text-secondary'
                          )}
                        >
                          {status === 'read' && (
                            <Check className="h-3 w-3" aria-hidden="true" />
                          )}
                          {READING_CIRCLE_STATUS_LABEL[status]}
                        </span>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          </section>

          {allRevealed && (
            <SessionRecapHub
              roomCode={roomCode}
              guestToken={guestToken || undefined}
              poems={poems}
              playerCount={state.players.length}
              error={error}
              isStartingNextRound={isStartingNow}
              onStartNextRound={handleStartNow}
              onBackToLobby={handleStartNewCycle}
            />
          )}
        </main>
      </div>
    </>
  );
}
