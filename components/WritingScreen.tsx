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
  const [text, setText] = useState('');
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Keep the line visible when the on-screen keyboard opens. iOS doesn't
  // reliably scroll a focused element into view inside this layout, so do it
  // ourselves after the keyboard animation settles.
  const handleTextareaFocus = () => {
    setHasFocus(true);
    setTimeout(() => {
      // `nearest` keeps the line visible without driving the submit button down
      // under the on-screen keyboard on the compact mobile layout.
      textareaRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }, 300);
  };

  const currentWordCount = countWords(text);
  const targetCount = assignment.targetWordCount;
  const isValid = currentWordCount === targetCount;
  const isReady = isValid && submissionState === 'idle';
  const placeholderText = `write ${numberToWord(targetCount)} word${targetCount === 1 ? '' : 's'}…`;

  // Announce validation state changes to screen readers (debounced)
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
    return <WaitingScreen roomCode={roomCode} guestToken={guestToken} />;
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

  return (
    <div
      data-testid={E2E_TEST_IDS.writingPhase}
      data-round={assignment.lineIndex + 1}
      className="relative min-h-screen bg-background flex flex-col items-center px-6 pb-6 pt-4 md:px-8 md:pb-8 md:pt-12"
    >
      {/* Screen reader live region for validation announcements */}
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {liveRegionMessage}
      </div>

      {/* Soft round clock — a hairline of gentle pressure, never a gate */}
      <div className="w-full max-w-3xl mb-5 md:mb-16">
        <RoundClock roundStartedAt={assignment.roundStartedAt} />
      </div>

      <div className="w-full max-w-3xl space-y-6 md:space-y-16">
        {showCoachmark && (
          <div className="border-l-2 border-primary py-1 pl-4 text-sm leading-relaxed text-text-secondary animate-fade-in-up">
            <p className="font-medium text-text-primary">
              You only see one carried line.
            </p>
            <p>Match the word slots, then pass it on.</p>
          </div>
        )}

        {/* The Memory - No container */}
        {assignment.previousLineText && (
          <div className="mb-4 md:mb-16 animate-fade-in-up">
            <p className="mb-3 text-[10px] font-mono uppercase tracking-widest text-primary">
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
              'w-full min-h-[110px] md:min-h-[320px] lg:min-h-[360px] field-sizing-content bg-transparent border-none outline-none resize-none',
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
        </div>

        <div className="flex justify-center">
          <WordSlots current={currentWordCount} target={targetCount} />
        </div>

        {/* Error Display */}
        {error && (
          <Alert variant="error" className="mt-8">
            {error}
          </Alert>
        )}

        {/* The Seal - Submit Button */}
        <div className="mt-6 md:mt-16 flex flex-col items-center gap-3">
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
            disabled={
              !isValid ||
              submissionState === 'submitting' ||
              submissionState === 'confirmed'
            }
            stampAnimate={submissionState === 'confirmed'}
            className={cn(
              'min-w-[240px] text-xl h-16 md:h-20',
              isReady && 'animate-ready-seal shadow-md'
            )}
          >
            {submissionState === 'submitting'
              ? 'Submitting…'
              : submissionState === 'confirmed'
                ? 'Submitted'
                : 'Submit'}
          </Button>
        </div>
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
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)]">
        <LoadingState message={LoadingMessages.LOADING_ROOM} />
      </div>
    );
  }

  if (assignment === null) {
    return (
      <>
        {showChrome && (
          <RoomChrome
            roomCode={roomCode}
            {...buildInProgressChromeCopy({ roundProgress })}
          />
        )}
        <WaitingScreen
          roomCode={roomCode}
          guestToken={guestToken}
          progressOverride={roundProgress}
          isLateJoiner
        />
      </>
    );
  }

  return (
    <>
      {showChrome && (
        <RoomChrome
          roomCode={roomCode}
          {...buildInProgressChromeCopy({ assignment })}
        />
      )}
      <WritingComposer
        key={`${assignment.poemId}:${assignment.lineIndex}`}
        assignment={assignment}
        guestToken={guestToken}
        queryArgs={queryArgs}
        roomCode={roomCode}
      />
    </>
  );
}
