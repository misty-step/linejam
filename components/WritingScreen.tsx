import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { useUser } from '../lib/auth';
import { countWords } from '../lib/wordCount';
import { logger } from '../lib/logger';
import { Button } from './ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { WaitingScreen } from './WaitingScreen';

interface WritingScreenProps {
  roomCode: string;
}

export function WritingScreen({ roomCode }: WritingScreenProps) {
  const { guestId } = useUser();
  const assignment = useQuery(api.game.getCurrentAssignment, {
    roomCode,
    guestId: guestId || undefined,
  });
  const submitLine = useMutation(api.game.submitLine);

  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedRound, setSubmittedRound] = useState<number | null>(null);
  const [lastSeenRound, setLastSeenRound] = useState<number | null>(null);

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
    if (!isValid || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await submitLine({
        poemId: assignment.poemId,
        lineIndex: assignment.lineIndex,
        text,
        guestId: guestId || undefined,
      });
      setSubmittedRound(assignment.lineIndex);
    } catch (error) {
      logger.error(
        { error, roomCode, poemId: assignment.poemId },
        'Failed to submit line'
      );
      setIsSubmitting(false);
      alert('Failed to submit line. Please try again.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-background)] p-6">
      <Card className="w-full max-w-md animate-fade-in">
        <CardHeader>
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-medium text-[var(--color-text-muted)]">
              Round {assignment.lineIndex + 1} of 9
            </span>
            <span className="text-sm font-medium text-[var(--color-text-muted)]">
              Target: {targetCount} words
            </span>
          </div>
          <CardTitle className="text-center">
            {assignment.lineIndex === 0
              ? 'Start the Poem'
              : 'Continue the Poem'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {assignment.previousLineText && (
            <div className="bg-[var(--color-muted)] p-4 rounded-[var(--radius-md)] border border-[var(--color-border)]">
              <p className="text-xs text-[var(--color-text-muted)] mb-2 uppercase tracking-wider">
                Previous line
              </p>
              <p className="text-lg leading-relaxed text-[var(--color-text-primary)] italic font-[var(--font-display)]">
                &ldquo;{assignment.previousLineText}&rdquo;
              </p>
            </div>
          )}

          <div className="space-y-3">
            <textarea
              className="w-full min-h-[120px] p-4 rounded-[var(--input-border-radius)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 resize-none transition-all duration-[var(--duration-fast)]"
              placeholder={`Write exactly ${targetCount} words...`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoFocus
            />

            <div className="flex justify-between items-center">
              <span
                className={`text-sm font-medium transition-colors duration-[var(--duration-fast)] ${
                  isValid
                    ? 'text-[var(--color-success)]'
                    : currentWordCount > targetCount
                      ? 'text-[var(--color-error)]'
                      : 'text-[var(--color-text-muted)]'
                }`}
              >
                {currentWordCount} / {targetCount} words
              </span>
              {currentWordCount > targetCount && (
                <span className="text-xs text-[var(--color-error)]">
                  Too many words
                </span>
              )}
            </div>
          </div>

          <Button
            onClick={handleSubmit}
            className="w-full"
            size="lg"
            disabled={!isValid || isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Line'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
