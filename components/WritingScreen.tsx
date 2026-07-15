'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useRoomQueryArgs } from '@/hooks/useRoomQueryArgs';
import { E2E_TEST_IDS } from '@/lib/e2eTestIds';
import { captureError } from '@/lib/error';
import { errorToFeedback } from '@/lib/errorFeedback';
import { cn } from '@/lib/utils';
import { countWords } from '@/lib/wordCount';
import { Alert } from '@/components/ui/Alert';
import { RoomChrome } from '@/components/RoomChrome';
import { Button } from '@/components/ui/Button';
import { LoadingMessages, LoadingState } from '@/components/ui/LoadingState';
import { WordSlots } from '@/components/ui/WordSlots';
import { RoundClock } from '@/components/ui/RoundClock';
import { WaitingScreen } from '@/components/WaitingScreen';
import { buildInProgressChromeCopy } from '@/lib/roomChromeCopy';
import {
  clearWritingDraft,
  readWritingDraft,
  saveWritingDraft,
  writingDraftKey,
} from '@/lib/writingDraft';

interface WritingScreenProps {
  roomCode: string;
  showChrome?: boolean;
}

type RoomQueryArgs = ReturnType<typeof useRoomQueryArgs>['queryArgs'];

const WRITING_COACHMARK_STORAGE_KEY = 'linejam:writing-coachmark-seen';

interface WritingAssignment {
  poemId: Id<'poems'>;
  lineIndex: number;
  targetWordCount: number;
  totalRounds?: number;
  isFinalRound?: boolean;
  previousLineText?: string | null;
  roundStartedAt?: number;
}

interface WritingComposerProps {
  assignment: WritingAssignment;
  guestToken?: string | null;
  queryArgs: RoomQueryArgs;
  roomCode: string;
}

function numberToWord(n: number): string {
  const words = ['zero', 'one', 'two', 'three', 'four', 'five'];
  return words[n] ?? String(n);
}

function shouldShowWritingCoachmark() {
  if (typeof window === 'undefined') return false;

  try {
    return window.localStorage.getItem(WRITING_COACHMARK_STORAGE_KEY) !== '1';
  } catch {
    return true;
  }
}

function markWritingCoachmarkSeen() {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(WRITING_COACHMARK_STORAGE_KEY, '1');
  } catch {
    // The coachmark is still visible for this render if storage is unavailable.
  }
}

function WritingComposer({
  assignment,
  guestToken,
  queryArgs,
  roomCode,
}: WritingComposerProps) {
  const submitLine = useMutation(api.game.submitLine);
  const draftKey = writingDraftKey(
    roomCode,
    assignment.poemId,
    assignment.lineIndex
  );
  const [text, setText] = useState(() => readWritingDraft(draftKey));
  const [draftWasRestored] = useState(() => text.length > 0);
  const [submissionState, setSubmissionState] = useState<
    'idle' | 'submitting' | 'confirmed'
  >('idle');
  const [showWaitingScreen, setShowWaitingScreen] = useState(false);

  // Pre-fetch waiting screen data during confirmation for smooth transition
  // When submissionState becomes 'confirmed', Convex starts fetching getRoundProgress
  // By the time we transition to WaitingScreen, data is already cached → no loading flash
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const prefetchWaitingData = useQuery(
    api.game.getRoundProgress,
    submissionState === 'confirmed' ? queryArgs : 'skip'
  );
  const [error, setError] = useState<string | null>(null);
  const [liveRegionMessage, setLiveRegionMessage] = useState('');
  const [hasFocus, setHasFocus] = useState(false);
  const [showCoachmark] = useState(shouldShowWritingCoachmark);
  const submitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Keep the line visible when the on-screen keyboard opens. The composer has
  // its own scroll region, so `nearest` does not move the in-flow action tray.
  const handleTextareaFocus = () => {
    setHasFocus(true);
    if (focusTimeoutRef.current) {
      clearTimeout(focusTimeoutRef.current);
    }
    focusTimeoutRef.current = setTimeout(() => {
      // `nearest` keeps the line visible without driving the submit button down
      // under the on-screen keyboard on the compact mobile layout.
      textareaRef.current?.scrollIntoView({
        behavior: 'auto',
        block: 'nearest',
      });
      focusTimeoutRef.current = null;
    }, 300);
  };

  const currentWordCount = countWords(text);
  const targetCount = assignment.targetWordCount;
  const isValid = currentWordCount === targetCount;
  const isReady = isValid && submissionState === 'idle';
  const placeholderText = `write ${numberToWord(targetCount)} word${targetCount === 1 ? '' : 's'}…`;

  // Announce validation state changes to screen readers (debounced)
  useEffect(() => {
    saveWritingDraft(draftKey, text);
  }, [draftKey, text]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (isValid) {
        setLiveRegionMessage('Ready to submit');
      } else if (currentWordCount > targetCount) {
        const diff = currentWordCount - targetCount;
        setLiveRegionMessage(`Remove ${diff} word${diff !== 1 ? 's' : ''}`);
      } else if (currentWordCount < targetCount && currentWordCount > 0) {
        const diff = targetCount - currentWordCount;
        setLiveRegionMessage(`Add ${diff} word${diff !== 1 ? 's' : ''}`);
      } else {
        setLiveRegionMessage('');
      }
    }, 500); // Debounce 500ms to avoid announcing every keystroke

    return () => clearTimeout(timeoutId);
  }, [isValid, currentWordCount, targetCount]);

  useEffect(() => {
    return () => {
      if (submitTimeoutRef.current) {
        clearTimeout(submitTimeoutRef.current);
      }
      if (focusTimeoutRef.current) {
        clearTimeout(focusTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [assignment.poemId, assignment.lineIndex]);

  useEffect(() => {
    if (showCoachmark) {
      markWritingCoachmarkSeen();
    }
  }, [showCoachmark]);

  if (showWaitingScreen) {
    return (
      <WaitingScreen roomCode={roomCode} guestToken={guestToken} embedded />
    );
  }

  const handleSubmit = async () => {
    if (!isValid) return;

    setSubmissionState('submitting');
    try {
      await submitLine({
        poemId: assignment.poemId,
        lineIndex: assignment.lineIndex,
        text,
        guestToken: guestToken || undefined,
      });
      clearWritingDraft(draftKey);

      // Show confirmation state briefly before transitioning to waiting
      setSubmissionState('confirmed');

      // After 1500ms, transition to waiting screen
      submitTimeoutRef.current = setTimeout(() => {
        setShowWaitingScreen(true);
        submitTimeoutRef.current = null;
      }, 1500);
    } catch (error) {
      captureError(error, { roomCode, poemId: assignment.poemId });
      setSubmissionState('idle');
      setError(errorToFeedback(error).message);
    }
  };

  const isSubmitDisabled =
    !isValid ||
    submissionState === 'submitting' ||
    submissionState === 'confirmed';

  const submitBlock = (
    <>
      {isReady && (
        <p className="text-xs font-mono uppercase tracking-widest text-primary animate-fade-in-up">
          Ready
        </p>
      )}
      <Button
        onClick={handleSubmit}
        data-testid={E2E_TEST_IDS.writingSubmitLineButton}
        data-ready={isReady ? 'true' : undefined}
        size="lg"
        disabled={isSubmitDisabled}
        stampAnimate={submissionState === 'confirmed'}
        className={cn(
          'h-[64px] w-full min-w-0 max-w-[240px] text-xl md:h-[80px] md:w-auto md:min-w-[240px] md:max-w-none',
          isReady && 'animate-ready-seal shadow-md'
        )}
      >
        {submissionState === 'submitting'
          ? 'Submitting…'
          : submissionState === 'confirmed'
            ? 'Submitted'
            : 'Submit'}
      </Button>
    </>
  );

  return (
    <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_minmax(0,auto)] overflow-hidden bg-background">
      {/* Screen reader live region for validation announcements */}
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {liveRegionMessage}
      </div>

      <div
        data-testid={E2E_TEST_IDS.writingScrollRegion}
        className="lj-safe-inline min-h-0 overflow-x-hidden overflow-y-auto overscroll-contain pb-6 pt-4 [--lj-safe-inline-space:clamp(12px,4vw,24px)] md:[--lj-safe-inline-space:2rem] md:pb-8 md:pt-12"
      >
        <div className="mx-auto w-full max-w-3xl">
          {/* Soft round clock — a hairline of gentle pressure, never a gate */}
          <div className="mb-5 w-full md:mb-16">
            <RoundClock roundStartedAt={assignment.roundStartedAt} />
          </div>

          <div className="w-full space-y-6 md:space-y-16">
            {showCoachmark && (
              <div className="border-l-2 border-primary py-1 pl-4 text-sm leading-relaxed text-text-secondary animate-fade-in-up">
                <p className="font-medium text-text-primary">
                  You only see one carried line.
                </p>
                <p>Match the word slots, then pass it on.</p>
              </div>
            )}

            {draftWasRestored && (
              <p aria-live="polite" className="text-sm text-text-secondary">
                Draft restored
              </p>
            )}

            {/* The Memory - No container */}
            {assignment.previousLineText && (
              <div
                data-testid={E2E_TEST_IDS.writingCarriedLine}
                className="mb-4 animate-fade-in-up md:mb-16"
              >
                <p className="mb-3 text-[0.625rem] font-mono uppercase tracking-widest text-primary">
                  Received line
                </p>
                <p className="text-2xl md:text-4xl lg:text-5xl font-[var(--font-display)] italic leading-relaxed text-text-secondary">
                  {assignment.previousLineText}
                </p>
              </div>
            )}

            {/* Submission Confirmation */}
            {submissionState === 'confirmed' && (
              <div className="mb-12 p-6 border-2 border-success bg-success/5 rounded-sm animate-fade-in-up">
                <div className="text-sm font-medium text-success mb-2 uppercase tracking-wide">
                  {assignment.isFinalRound
                    ? 'Last line sealed'
                    : '✓ Your Line Submitted'}
                </div>
                {assignment.isFinalRound && (
                  <p className="mb-3 text-sm text-text-secondary">
                    Reveal is next.
                  </p>
                )}
                <p className="text-lg italic font-[var(--font-display)] text-text-primary">
                  &ldquo;{text}&rdquo;
                </p>
              </div>
            )}

            {/* The Canvas - Borderless, blends with page */}
            <div className="relative">
              {/* Focus marker (marginalia bar) */}
              {hasFocus && (
                <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-primary" />
              )}

              <textarea
                ref={textareaRef}
                data-testid={E2E_TEST_IDS.writingLineInput}
                className={cn(
                  'w-full min-w-0 max-w-full min-h-[64px] md:min-h-[320px] lg:min-h-[360px] field-sizing-content overflow-x-hidden bg-transparent border-none outline-none resize-none',
                  'text-3xl md:text-5xl lg:text-6xl font-[var(--font-display)] leading-tight',
                  'text-text-primary',
                  'placeholder:text-text-muted/20',
                  'pl-6'
                )}
                placeholder={placeholderText}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setError(null);
                }}
                onFocus={handleTextareaFocus}
                onBlur={() => setHasFocus(false)}
                spellCheck={false}
                aria-label={`Write your line for round ${assignment.lineIndex + 1}. Target: ${targetCount} ${targetCount === 1 ? 'word' : 'words'}.`}
                aria-required="true"
                aria-invalid={!isValid}
                aria-describedby="word-slots"
              />

              {/*
            Word chips sit tight against the line, left-aligned with the
            textarea's own `pl-6` — not centered in a full-width row, which
            reads as one lonely floating box for short targets. Pulling this
            out of the outer `space-y-*` stack (it's nested in the canvas,
            not a sibling of it) is what removes the dead gap under the
            textarea.
          */}
              <div className="mt-2 pl-6 md:mt-4">
                <WordSlots
                  current={currentWordCount}
                  target={targetCount}
                  text={text}
                />
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <Alert variant="error" className="mt-8">
                {error}
              </Alert>
            )}
          </div>
        </div>
      </div>

      {/*
        The action zone is a flex sibling, not an overlay. It may shrink into
        its own scroll region when room chrome plus 200% text would otherwise
        push it below the visual viewport.
      */}
      <div
        data-testid={E2E_TEST_IDS.writingActionZone}
        className="lj-safe-inline min-h-0 max-h-[55%] overflow-x-hidden overflow-y-auto flex flex-col items-center gap-[12px] border-t-2 border-primary/20 bg-background/95 pt-[12px] pb-[max(12px,env(safe-area-inset-bottom))] shadow-[var(--shadow-lg)] backdrop-blur-md [--lj-safe-inline-space:clamp(12px,4vw,24px)] md:[--lj-safe-inline-space:2rem] md:gap-[16px] md:pt-[16px] md:pb-[max(16px,env(safe-area-inset-bottom))]"
      >
        {submitBlock}
      </div>
    </div>
  );
}

export function WritingScreen({
  roomCode,
  showChrome = false,
}: WritingScreenProps) {
  const { guestToken, shouldSkip, queryArgs } = useRoomQueryArgs(roomCode);
  const assignment = useQuery(api.game.getCurrentAssignment, queryArgs);
  const roundProgress = useQuery(
    api.game.getRoundProgress,
    showChrome && assignment === null ? queryArgs : 'skip'
  );

  if (shouldSkip || assignment === undefined) {
    return (
      <div className="lj-game-viewport flex items-center justify-center bg-[var(--color-background)]">
        <LoadingState message={LoadingMessages.LOADING_ROOM} />
      </div>
    );
  }

  if (assignment === null) {
    return (
      <div className="lj-game-frame lj-viewport-offset relative flex min-h-0 flex-col overflow-hidden bg-background">
        {showChrome && (
          <RoomChrome
            roomCode={roomCode}
            {...buildInProgressChromeCopy({ roundProgress })}
            compact
          />
        )}
        <WaitingScreen
          roomCode={roomCode}
          guestToken={guestToken}
          progressOverride={roundProgress}
          isLateJoiner
          embedded
        />
      </div>
    );
  }

  return (
    <div
      data-testid={E2E_TEST_IDS.writingPhase}
      data-round={assignment.lineIndex + 1}
      className="lj-game-frame lj-viewport-offset relative flex min-h-0 flex-col bg-background"
    >
      {showChrome && (
        <RoomChrome
          roomCode={roomCode}
          {...buildInProgressChromeCopy({ assignment })}
          compact
        />
      )}
      <WritingComposer
        key={`${assignment.poemId}:${assignment.lineIndex}`}
        assignment={assignment}
        guestToken={guestToken}
        queryArgs={queryArgs}
        roomCode={roomCode}
      />
    </div>
  );
}
