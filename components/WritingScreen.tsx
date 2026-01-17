import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { useUser } from '../lib/auth';
import { countWords } from '../lib/wordCount';
import { captureError } from '../lib/error';
import { cn } from '../lib/utils';
import { Button } from './ui/Button';
import { Alert } from './ui/Alert';
import { WordSlots } from './ui/WordSlots';
import { LoadingState, LoadingMessages } from './ui/LoadingState';
import { WaitingScreen } from './WaitingScreen';

interface WritingScreenProps {
  roomCode: string;
}

export function WritingScreen({ roomCode }: WritingScreenProps) {
  const { guestToken, isLoading: isAuthLoading } = useUser();

  // Skip query until auth is loaded to avoid race condition
  const assignment = useQuery(
    api.game.getCurrentAssignment,
    isAuthLoading ? 'skip' : { roomCode, guestToken: guestToken || undefined }
  );
  const submitLine = useMutation(api.game.submitLine);

  const [text, setText] = useState('');
  const [submissionState, setSubmissionState] = useState<
    'idle' | 'submitting' | 'confirmed' | 'waiting'
  >('idle');

  // Pre-fetch waiting screen data during confirmation for smooth transition
  // When submissionState becomes 'confirmed', Convex starts fetching getRoundProgress
  // By the time we transition to WaitingScreen, data is already cached → no loading flash
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const prefetchWaitingData = useQuery(
    api.game.getRoundProgress,
    submissionState === 'confirmed'
      ? { roomCode, guestToken: guestToken || undefined }
      : 'skip'
  );
  const [submittedRound, setSubmittedRound] = useState<number | null>(null);
  const [lastSeenRound, setLastSeenRound] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [liveRegionMessage, setLiveRegionMessage] = useState('');
  const [hasFocus, setHasFocus] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset text when assignment changes (new round)
  const currentRound = assignment?.lineIndex;
  if (currentRound !== undefined && currentRound !== lastSeenRound) {
    setText('');
    setSubmissionState('idle');
    setLastSeenRound(currentRound);
  }

  // Calculate validation state (needed for live region, even when showing waiting screen)
  const currentWordCount = assignment ? countWords(text) : 0;
  const targetCount = assignment?.targetWordCount ?? 0;
  const isValid = currentWordCount === targetCount;

  // Convert number to words for placeholder
  const numberToWord = (n: number): string => {
    const words = ['zero', 'one', 'two', 'three', 'four', 'five'];
    return words[n] ?? String(n);
  };
  const placeholderText = `write ${numberToWord(targetCount)} word${targetCount === 1 ? '' : 's'}…`;

  // Announce validation state changes to screen readers (debounced)
  useEffect(() => {
    if (!assignment) return; // Don't announce when no assignment

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
  }, [assignment, isValid, currentWordCount, targetCount]);

  // Show loading state while auth is initializing
  if (isAuthLoading || assignment === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)]">
        <LoadingState message={LoadingMessages.LOADING_ROOM} />
      </div>
    );
  }

  // Show waiting screen if no assignment or just submitted
  if (assignment === null || submittedRound === assignment.lineIndex) {
    return <WaitingScreen roomCode={roomCode} />;
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
      setTimeout(() => {
        setSubmittedRound(assignment.lineIndex);
        setSubmissionState('waiting');
      }, 1500);
    } catch (error) {
      captureError(error, { roomCode, poemId: assignment.poemId });
      setSubmissionState('idle');
      setError('Failed to submit line. Please try again.');
    }
  };

  return (
    <div className="relative min-h-screen bg-background flex flex-col items-center pt-12 md:pt-24 p-6">
      {/* Screen reader live region for validation announcements */}
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {liveRegionMessage}
      </div>

      <div className="w-full max-w-3xl space-y-16">
        {/* Status Row - Justified between (left: round, right: counter) */}
        <div className="flex items-center justify-between mb-12">
          <div className="text-xs font-mono uppercase tracking-widest text-text-muted">
            Round {assignment.lineIndex + 1} / 9
          </div>
          <WordSlots current={currentWordCount} target={targetCount} />
        </div>

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
            onFocus={() => setHasFocus(true)}
            onBlur={() => setHasFocus(false)}
            autoFocus
            spellCheck={false}
            aria-label={`Write your line for round ${assignment.lineIndex + 1}. Target: ${targetCount} ${targetCount === 1 ? 'word' : 'words'}.`}
            aria-required="true"
            aria-invalid={!isValid}
            aria-describedby="word-slots"
          />
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
