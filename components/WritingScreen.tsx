import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { useUser } from '../lib/auth';
import { countWords } from '../lib/wordCount';
import { captureError } from '../lib/error';
import { cn } from '../lib/utils';
import { Button } from './ui/Button';
import { Alert } from './ui/Alert';
import { EnsoCounter } from './ui/EnsoCounter';
import { WaitingScreen } from './WaitingScreen';

interface WritingScreenProps {
  roomCode: string;
}

export function WritingScreen({ roomCode }: WritingScreenProps) {
  const { guestToken } = useUser();
  const assignment = useQuery(api.game.getCurrentAssignment, {
    roomCode,
    guestToken: guestToken || undefined,
  });
  const submitLine = useMutation(api.game.submitLine);

  const [text, setText] = useState('');
  const [submissionState, setSubmissionState] = useState<
    'idle' | 'submitting' | 'confirmed' | 'waiting'
  >('idle');
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

  // Show waiting screen if no assignment or just submitted
  if (!assignment || submittedRound === assignment.lineIndex) {
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
    <div className="relative min-h-screen bg-[var(--color-background)] flex flex-col items-center pt-12 md:pt-24 p-6">
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
        {/* Status Row - Right-aligned with normal flow */}
        <div className="flex items-center justify-end gap-6 mb-12">
          <div className="text-xs font-mono uppercase tracking-widest text-[var(--color-text-muted)]">
            Round {assignment.lineIndex + 1} / 9
          </div>
          <EnsoCounter current={currentWordCount} target={targetCount} />
        </div>

        {/* The Memory - No container */}
        {assignment.previousLineText && (
          <div className="mb-16 animate-fade-in-up">
            <p className="text-4xl md:text-5xl font-[var(--font-display)] italic leading-relaxed text-[var(--color-text-secondary)]">
              {assignment.previousLineText}
            </p>
          </div>
        )}

        {/* Submission Confirmation */}
        {submissionState === 'confirmed' && (
          <div className="mb-12 p-6 border-2 border-[var(--color-success)] bg-[var(--color-success)]/5 rounded-[var(--radius-sm)] animate-fade-in-up">
            <div className="text-sm font-medium text-[var(--color-success)] mb-2 uppercase tracking-wide">
              ✓ Your Line Submitted
            </div>
            <p className="text-lg italic font-[var(--font-display)] text-[var(--color-text-primary)]">
              &ldquo;{text}&rdquo;
            </p>
          </div>
        )}

        {/* The Canvas - Borderless, blends with page */}
        <div className="relative">
          {/* Focus marker (marginalia bar) */}
          {hasFocus && (
            <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-[var(--color-primary)]" />
          )}

          <textarea
            ref={textareaRef}
            className={cn(
              'w-full min-h-[280px] bg-transparent border-none outline-none resize-none',
              'text-5xl md:text-6xl font-[var(--font-display)] leading-tight',
              'text-[var(--color-text-primary)]',
              'placeholder:text-[var(--color-text-muted)]/20',
              'pl-6'
            )}
            placeholder="Type your line here..."
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
            aria-describedby="enso-counter"
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
            className={cn(
              'min-w-[240px] text-xl h-20',
              isValid && 'shadow-[4px_4px_0px_rgba(232,93,43,0.2)]'
            )}
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
