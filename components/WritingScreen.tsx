'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useRoomQueryArgs } from '@/hooks/useRoomQueryArgs';
import { captureError } from '@/lib/error';
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
import { getSpark } from '@/lib/sparks';

interface WritingScreenProps {
  roomCode: string;
  showChrome?: boolean;
}

type RoomQueryArgs = ReturnType<typeof useRoomQueryArgs>['queryArgs'];

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
  const submitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Keep the line visible when the on-screen keyboard opens. iOS doesn't
  // reliably scroll a focused element into view inside this layout, so do it
  // ourselves after the keyboard animation settles.
  const handleTextareaFocus = () => {
    setHasFocus(true);
    setTimeout(() => {
      textareaRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 300);
  };

  const currentWordCount = countWords(text);
  const targetCount = assignment.targetWordCount;
  const isValid = currentWordCount === targetCount;
  const placeholderText = `write ${numberToWord(targetCount)} word${targetCount === 1 ? '' : 's'}…`;
  // A gentle, ignorable nudge — stable per poem+round so it never rerolls.
  const spark = getSpark(assignment.poemId, assignment.lineIndex);

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
      setError('Failed to submit line. Please try again.');
    }
  };

  return (
    <div className="relative min-h-screen bg-background flex flex-col items-center px-6 pb-6 pt-8 md:px-8 md:pb-8 md:pt-12">
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
      <div className="w-full max-w-3xl mb-12 md:mb-16">
        <RoundClock roundStartedAt={assignment.roundStartedAt} />
      </div>

      <div className="w-full max-w-3xl space-y-16">
        {/* The Memory - No container */}
        {assignment.previousLineText && (
          <div className="mb-16 animate-fade-in-up">
            <p className="text-2xl md:text-4xl lg:text-5xl font-[var(--font-display)] italic leading-relaxed text-text-secondary">
              {assignment.previousLineText}
            </p>
          </div>
        )}

        {/* Submission Confirmation */}
        {submissionState === 'confirmed' && (
          <div className="mb-12 p-6 border-2 border-success bg-success/5 rounded-sm animate-fade-in-up">
            <div className="text-sm font-medium text-success mb-2 uppercase tracking-wide">
              ✓ Your Line Submitted
            </div>
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
            className={cn(
              'w-full min-h-[280px] md:min-h-[320px] lg:min-h-[360px] bg-transparent border-none outline-none resize-none',
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

        <div className="flex items-center justify-between gap-4">
          {spark ? (
            <p className="text-sm italic text-text-muted/70 select-none">
              spark: {spark}
            </p>
          ) : (
            <span />
          )}
          <WordSlots current={currentWordCount} target={targetCount} />
        </div>

        {/* Error Display */}
        {error && (
          <Alert variant="error" className="mt-8">
            {error}
          </Alert>
        )}

        {/* The Seal - Submit Button */}
        <div className="mt-16 flex justify-center">
          <Button
            onClick={handleSubmit}
            size="lg"
            disabled={
              !isValid ||
              submissionState === 'submitting' ||
              submissionState === 'confirmed'
            }
            stampAnimate={submissionState === 'confirmed'}
            className={cn('min-w-[240px] text-xl h-20', isValid && 'shadow-md')}
          >
            {submissionState === 'submitting'
              ? 'Sealing...'
              : submissionState === 'confirmed'
                ? 'Sealed!'
                : 'Seal Your Line'}
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
