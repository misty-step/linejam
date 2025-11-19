import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { useUser } from '../lib/auth';
import { countWords } from '../lib/wordCount';
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

  // Reset text when assignment changes (new round) - using ref pattern to avoid setState in effect
  const currentRound = assignment?.lineIndex;
  if (currentRound !== undefined && currentRound !== lastSeenRound) {
    setText('');
    setIsSubmitting(false);
    setLastSeenRound(currentRound);
  }

  // If we don't have an assignment yet, or we just submitted for this round, show waiting
  // We track `submittedRound` to optimistically show waiting screen while the backend processes
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
      console.error('Failed to submit line:', error);
      setIsSubmitting(false);
      alert('Failed to submit line. Please try again.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-500">
              Round {assignment.lineIndex + 1} of 9
            </span>
            <span className="text-sm font-medium text-gray-500">
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
            <div className="bg-gray-100 p-4 rounded-lg border border-gray-200">
              <p className="text-sm text-gray-500 mb-1">Previous line:</p>
              <p className="text-lg font-medium text-gray-900 italic">
                &ldquo;{assignment.previousLineText}&rdquo;
              </p>
            </div>
          )}

          <div className="space-y-2">
            <textarea
              className="w-full min-h-[100px] p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-black focus:border-transparent resize-none"
              placeholder={`Write exactly ${targetCount} words...`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoFocus
            />

            <div className="flex justify-between items-center">
              <span
                className={`text-sm font-medium transition-colors ${
                  isValid
                    ? 'text-green-600'
                    : currentWordCount > targetCount
                      ? 'text-red-500'
                      : 'text-gray-500'
                }`}
              >
                {currentWordCount} / {targetCount} words
              </span>
              {currentWordCount > targetCount && (
                <span className="text-xs text-red-500">Too many words!</span>
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
