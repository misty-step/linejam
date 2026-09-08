'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation } from 'convex/react';
import type { FunctionArgs, FunctionReturnType } from 'convex/server';
import { api } from '../convex/_generated/api';
import { useUser } from '../lib/auth';
import { cn } from '../lib/utils';
import { E2E_TEST_IDS } from '../lib/e2eTestIds';
import { captureError } from '../lib/error';
import { errorToFeedback } from '../lib/errorFeedback';
import { toErrorReportable } from '../lib/errorCore';
import { Alert } from './ui/Alert';
import { Button } from './ui/Button';
import { PoemDisplay } from './PoemDisplay';
import { LoadingState } from './ui/LoadingState';
import { Avatar } from './ui/Avatar';
import { Id } from '../convex/_generated/dataModel';
import { hashRoomId, trackGameCompleted } from '../lib/analytics';
import {
  SessionRecapHub,
  type SessionRecapHubDependencies,
} from './SessionRecapHub';
import { Check } from 'lucide-react';

type ReadingCircleStatus = 'read' | 'reading-now' | 'up-next' | null;

const READING_CIRCLE_STATUS_LABEL = {
  read: 'Read',
  'reading-now': 'Reading now',
  'up-next': 'Up next',
} as const satisfies Record<Exclude<ReadingCircleStatus, null>, string>;

type RevealState =
  FunctionReturnType<typeof api.game.getRevealPhaseState> | undefined;
type RevealPoem = (
  args: FunctionArgs<typeof api.game.revealPoem>
) => Promise<FunctionReturnType<typeof api.game.revealPoem>>;
type StartNewCycle = (
  args: FunctionArgs<typeof api.game.startNewCycle>
) => Promise<FunctionReturnType<typeof api.game.startNewCycle>>;
type StartGame = (
  args: FunctionArgs<typeof api.game.startGame>
) => Promise<FunctionReturnType<typeof api.game.startGame>>;

function useDefaultRevealState(args: {
  roomCode: string;
  guestToken?: string;
}): RevealState {
  return useQuery(api.game.getRevealPhaseState, args);
}

function useDefaultRevealPoem(): RevealPoem {
  return useMutation(api.game.revealPoem);
}

function useDefaultStartNewCycle(): StartNewCycle {
  return useMutation(api.game.startNewCycle);
}

function useDefaultStartGame(): StartGame {
  return useMutation(api.game.startGame);
}
export interface RevealPhaseDependencies {
  useUser: typeof useUser;
  useRevealState: typeof useDefaultRevealState;
  useRevealPoem: () => RevealPoem;
  useStartNewCycle: () => StartNewCycle;
  useStartGame: () => StartGame;
  hashRoomId: typeof hashRoomId;
  trackGameCompleted: typeof trackGameCompleted;
  sessionRecapDependencies?: SessionRecapHubDependencies;
}

const defaultDependencies: RevealPhaseDependencies = {
  useUser,
  useRevealState: useDefaultRevealState,
  useRevealPoem: useDefaultRevealPoem,
  useStartNewCycle: useDefaultStartNewCycle,
  useStartGame: useDefaultStartGame,
  hashRoomId,
  trackGameCompleted,
};

interface RevealPhaseProps {
  roomCode: string;
  dependencies?: RevealPhaseDependencies;
}

export function RevealPhase({
  roomCode,
  dependencies = defaultDependencies,
}: RevealPhaseProps) {
  const { guestToken } = dependencies.useUser();
  const [showingPoemId, setShowingPoemId] = useState<Id<'poems'> | null>(null);
  const [isRevealingId, setIsRevealingId] = useState<Id<'poems'> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStartingNow, setIsStartingNow] = useState(false);
  const readingNowRef = useRef<HTMLDivElement>(null);
  const previousReadingNowId = useRef<Id<'poems'> | null>(null);
  const lastShowingPoemId = useRef<Id<'poems'> | null>(null);

  const state = dependencies.useRevealState({
    roomCode,
    guestToken: guestToken || undefined,
  });

  const revealPoemMutation = dependencies.useRevealPoem();
  const startNewCycleMutation = dependencies.useStartNewCycle();
  const startGameMutation = dependencies.useStartGame();
  const sortedPoems = useMemo(
    () =>
      [...(state?.poems ?? [])].sort((a, b) => a.indexInRoom - b.indexInRoom),
    [state?.poems]
  );
  const readingNowPoem = sortedPoems.find((poem) => !poem.isRevealed) ?? null;
  const { hashRoomId: hashCompletedRoomId, trackGameCompleted } = dependencies;
  const readingNowId = readingNowPoem?._id ?? null;

  useEffect(() => {
    if (showingPoemId) return;
    if (readingNowId && readingNowId !== previousReadingNowId.current) {
      readingNowRef.current?.focus();
      previousReadingNowId.current = readingNowId;
    }
  }, [readingNowId, showingPoemId]);

  useEffect(() => {
    if (showingPoemId) {
      lastShowingPoemId.current = showingPoemId;
      return;
    }
    const previousPoemId = lastShowingPoemId.current;
    if (!previousPoemId) return;
    lastShowingPoemId.current = null;
    const target =
      document.getElementById(`read-poem-${previousPoemId}`) ??
      document.getElementById('session-recap-title') ??
      readingNowRef.current;
    target?.focus();
  }, [showingPoemId]);

  // Track game completion once when all poems are revealed
  const hasTrackedCompletion = useRef(false);
  useEffect(() => {
    if (!state) return;
    const { allRevealed, poems } = state;

    if (allRevealed && !hasTrackedCompletion.current) {
      hasTrackedCompletion.current = true;
      if (state.roomId && state.cycle) {
        trackGameCompleted({
          roomIdHash: hashCompletedRoomId(state.roomId),
          cycle: state.cycle,
          round: poems.length > 0 ? 8 : 0,
        });
      }
    }
  }, [state, hashCompletedRoomId, trackGameCompleted]);

  const handleStartNow = async () => {
    setError(null);
    setIsStartingNow(true);

    try {
      await startGameMutation({
        code: roomCode,
        guestToken: guestToken || undefined,
      });
    } catch (cause) {
      const error = toErrorReportable(cause);
      const feedback = errorToFeedback(error);
      setError(feedback.message);
      captureError(error, { roomCode });
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
    } catch (cause) {
      const error = toErrorReportable(cause);
      const feedback = errorToFeedback(error);
      setError(feedback.message);
      captureError(error, { roomCode });
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
    } catch (cause) {
      const error = toErrorReportable(cause);
      const feedback = errorToFeedback(error);
      setError(feedback.message);
      captureError(error, { roomCode });
    }
  };

  if (!state)
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center bg-background">
        <LoadingState message="Loading poems..." />
      </div>
    );

  const { myPoems, allRevealed, poems } = state;
  const allStableIds = poems.map((p) => p.readerStableId);

  const displayingPoem = showingPoemId
    ? [...(myPoems ?? []), ...(state.revealedPoems ?? [])].find(
        (poem) => poem._id === showingPoemId
      )
    : null;

  if (displayingPoem) {
    // Count unique poets for this poem
    const uniquePoets = new Set(displayingPoem.lines.map((l) => l.authorName))
      .size;

    return (
      <>
        <PoemDisplay
          poemId={displayingPoem._id}
          guestToken={guestToken || undefined}
          lines={displayingPoem.lines}
          onDone={() => setShowingPoemId(null)}
          alreadyRevealed={displayingPoem.isRevealed}
          allStableIds={allStableIds}
          roomId={state.roomId}
          cycle={state.cycle}
          metadata={{
            createdAt: displayingPoem.createdAt,
            firstLine: displayingPoem.preview,
            uniquePoets,
            readerName: displayingPoem.readerName,
            readerStableId: displayingPoem.readerStableId,
            readerAvatarId: displayingPoem.readerAvatarId,
            poemNumber: displayingPoem.indexInRoom + 1,
          }}
        />
      </>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-background font-sans">
      <div
        data-testid={E2E_TEST_IDS.revealPhase}
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
      >
        <main className="lj-safe-inline mx-auto w-full max-w-xl space-y-5 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] [--lj-safe-inline-space:1rem] sm:py-8">
          {!allRevealed && (
            <>
              <h1 className="text-2xl font-bold leading-snug text-text-primary">
                Reading circle
              </h1>
              {error && <Alert variant="error">{error}</Alert>}
              {myPoems && myPoems.length > 0 && (
                <section aria-label="Your poems" className="space-y-3">
                  {myPoems
                    .filter((poem) => !poem.isRevealed)
                    .map((poem) => (
                      <div
                        key={poem._id}
                        className="space-y-[12px] rounded-lg bg-surface p-[16px]"
                      >
                        <div className="flex items-center gap-[12px]">
                          <Avatar
                            stableId={poem.readerStableId}
                            displayName={poem.readerName}
                            avatarId={poem.readerAvatarId}
                            allStableIds={allStableIds}
                            size="md"
                          />
                          <h2 className="min-w-0 text-xl font-bold leading-snug text-text-primary [overflow-wrap:anywhere]">
                            {poem.isFallbackReader
                              ? `Step in for ${poem.readerName}`
                              : `Poem ${poem.indexInRoom + 1}`}
                          </h2>
                        </div>
                        <p className="text-lg leading-relaxed text-text-secondary [overflow-wrap:anywhere]">
                          {poem.preview}…
                        </p>
                        <Button
                          id={`read-poem-${poem._id}`}
                          onClick={() => handleReveal(poem._id)}
                          data-testid={E2E_TEST_IDS.revealPoemButton}
                          size="lg"
                          className="min-h-[48px] w-full px-[16px] py-[12px] text-base"
                          disabled={isRevealingId === poem._id}
                        >
                          {isRevealingId === poem._id
                            ? 'Opening...'
                            : poem.isFallbackReader
                              ? 'Step in and read'
                              : 'Read poem'}
                        </Button>
                      </div>
                    ))}
                  {myPoems
                    .filter((poem) => poem.isRevealed)
                    .map((poem) => (
                      <Button
                        id={`read-poem-${poem._id}`}
                        key={poem._id}
                        onClick={() => setShowingPoemId(poem._id)}
                        variant="outline"
                        className="min-h-11 w-full"
                      >
                        Read poem {poem.indexInRoom + 1} again
                      </Button>
                    ))}
                </section>
              )}

              <section
                aria-labelledby="reading-order-title"
                className="space-y-3"
              >
                <h2
                  id="reading-order-title"
                  className="text-base font-bold text-text-primary"
                >
                  Reading order
                </h2>
                <p role="status" aria-live="polite" className="sr-only">
                  {readingNowPoem
                    ? readingNowPoem.readerName + ' is reading now.'
                    : 'The reading circle is complete.'}
                </p>
                <ol>
                  {(() => {
                    const upNextId = sortedPoems.find(
                      (poem) => !poem.isRevealed && poem._id !== readingNowId
                    )?._id;

                    return sortedPoems.map((poem) => {
                      const status: ReadingCircleStatus = poem.isRevealed
                        ? 'read'
                        : poem._id === readingNowId
                          ? 'reading-now'
                          : poem._id === upNextId
                            ? 'up-next'
                            : null;

                      return (
                        <li key={poem._id}>
                          <div
                            ref={
                              status === 'reading-now'
                                ? readingNowRef
                                : undefined
                            }
                            tabIndex={status === 'reading-now' ? -1 : undefined}
                            aria-current={
                              status === 'reading-now' ? 'true' : undefined
                            }
                            className={cn(
                              'flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border-subtle px-3 py-3 focus-visible:outline-2 focus-visible:outline-focus-ring',
                              status === 'reading-now' &&
                                'rounded-xl bg-surface'
                            )}
                          >
                            <div className="flex min-w-0 flex-1 items-center gap-3">
                              <Avatar
                                stableId={poem.readerStableId}
                                displayName={poem.readerName}
                                avatarId={poem.readerAvatarId}
                                allStableIds={allStableIds}
                                size="sm"
                                outlined={!poem.isRevealed}
                              />
                              <div className="min-w-0">
                                <span className="block font-semibold text-text-primary [overflow-wrap:anywhere]">
                                  {poem.readerName}
                                </span>
                                <span className="block text-sm text-text-secondary">
                                  Poem {poem.indexInRoom + 1}
                                </span>
                              </div>
                            </div>
                            {status && (
                              <span
                                className={cn(
                                  'inline-flex items-center gap-1 text-sm font-semibold',
                                  status === 'reading-now'
                                    ? 'text-primary'
                                    : 'text-text-secondary'
                                )}
                              >
                                {status === 'read' && (
                                  <Check
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                  />
                                )}
                                {READING_CIRCLE_STATUS_LABEL[status]}
                              </span>
                            )}
                          </div>
                        </li>
                      );
                    });
                  })()}
                </ol>
              </section>
            </>
          )}

          {allRevealed && (
            <SessionRecapHub
              roomCode={roomCode}
              roomId={state.roomId}
              cycle={state.cycle}
              guestToken={guestToken || undefined}
              poems={poems}
              playerCount={state.players.length}
              error={error}
              isStartingNextRound={isStartingNow}
              onStartNextRound={handleStartNow}
              onBackToLobby={handleStartNewCycle}
              dependencies={dependencies.sessionRecapDependencies}
            />
          )}
        </main>
      </div>
    </div>
  );
}
