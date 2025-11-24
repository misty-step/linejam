import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { useUser } from '../lib/auth';
import { countWords } from '../lib/wordCount';
import { captureError } from '../lib/error';
import { Button } from './ui/Button';
import { Label } from './ui/Label';
import { Alert } from './ui/Alert';
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedRound, setSubmittedRound] = useState<number | null>(null);
  const [lastSeenRound, setLastSeenRound] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset text when assignment changes (new round)
  const currentRound = assignment?.lineIndex;
  if (currentRound !== undefined && currentRound !== lastSeenRound) {
    setText('');
    setIsSubmitting(false);
    setLastSeenRound(currentRound);
  }

  // Show waiting screen if no assignment or just submitted
  if (!assignment || submittedRound === assignment.lineIndex) {
    return <WaitingScreen roomCode={roomCode} />;
  }

  const currentWordCount = countWords(text);
  const targetCount = assignment.targetWordCount;
  const isValid = currentWordCount === targetCount;

  const handleSubmit = async () => {
    if (!isValid) return;

    setIsSubmitting(true);
    try {
      await submitLine({
        poemId: assignment.poemId,
        lineIndex: assignment.lineIndex,
        text,
        guestToken: guestToken || undefined,
      });
      setSubmittedRound(assignment.lineIndex);
    } catch (error) {
      captureError(error, { roomCode, poemId: assignment.poemId });
      setIsSubmitting(false);
      setError('Failed to submit line. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-background)] flex flex-col items-center pt-12 md:pt-24 p-6">
      {/* Header / Status */}
      <div className="w-full max-w-2xl flex justify-between items-end mb-8 border-b border-[var(--color-border)] pb-4">
        <div className="space-y-1">
          <Label>Contribution</Label>
          <div className="text-3xl font-[var(--font-display)]">
            Round {assignment.lineIndex + 1} / 9
          </div>
        </div>
        <div className="text-right">
          <div
            className={`text-2xl font-mono font-medium ${
              isValid
                ? 'text-[var(--color-success)]'
                : currentWordCount > targetCount
                  ? 'text-[var(--color-error)]'
                  : 'text-[var(--color-text-secondary)]'
            }`}
          >
            {currentWordCount}{' '}
            <span className="text-[var(--color-text-muted)]">
              / {targetCount}
            </span>
          </div>
          <div className="text-xs uppercase tracking-wide text-[var(--color-text-muted)] mt-1">
            Target Count
          </div>
        </div>
      </div>

      <div className="w-full max-w-2xl space-y-12">
        {/* The Prompt (Previous Line) */}
        {assignment.previousLineText && (
          <div className="space-y-3 animate-fade-in-up">
            <Label>Preceding Line</Label>
            <div className="relative p-8 bg-[var(--color-surface)] border border-[var(--color-border)] shadow-[var(--shadow-sm)]">
              <div className="absolute top-0 left-0 w-1 h-full bg-[var(--color-text-secondary)]" />
              <p className="text-2xl md:text-3xl font-[var(--font-display)] italic leading-relaxed text-[var(--color-text-primary)]">
                &ldquo;{assignment.previousLineText}&rdquo;
              </p>
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="space-y-6">
          <div className="space-y-2">
            <Label as="label">Your Line</Label>
            <textarea
              className="w-full min-h-[200px] bg-transparent text-3xl md:text-4xl font-[var(--font-display)] placeholder:text-[var(--color-text-muted)]/30 focus:outline-none resize-none leading-tight"
              placeholder="Type here..."
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setError(null);
              }}
              autoFocus
              spellCheck={false}
            />
          </div>

          <div className="pt-8 border-t border-[var(--color-border-subtle)]">
            {error && (
              <Alert variant="error" className="mb-4">
                {error}
              </Alert>
            )}
            <div className="flex justify-end">
              <Button
                onClick={handleSubmit}
                size="lg"
                className="min-w-[200px] text-lg h-16"
                disabled={!isValid || isSubmitting}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Line'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
