'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import type { FunctionArgs, FunctionReturnType } from 'convex/server';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useRoomQueryArgs, type RoomQueryArgs } from '@/hooks/useRoomQueryArgs';
import { E2E_TEST_IDS } from '@/lib/e2eTestIds';
import { captureError } from '@/lib/error';
import { errorToFeedback } from '@/lib/errorFeedback';
import { toErrorReportable } from '@/lib/errorCore';
import { cn } from '@/lib/utils';
import { hashRoomId, trackLineSubmitted } from '@/lib/analytics';
import { countWords } from '@/lib/wordCount';
import { normalizeLineText } from '@/convex/lib/lineText';
import { Alert } from '@/components/ui/Alert';
import { RoomChrome } from '@/components/RoomChrome';
import { Button } from '@/components/ui/Button';
import { LoadingMessages, LoadingState } from '@/components/ui/LoadingState';
import { RoundProgress } from '@/components/ui/RoundProgress';
import {
  WaitingScreen,
  type WaitingScreenDependencies,
} from '@/components/WaitingScreen';
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
  dependencies?: WritingScreenDependencies;
}

type CurrentAssignmentResult =
  FunctionReturnType<typeof api.game.getCurrentAssignment> | undefined;
type RoundProgressResult =
  FunctionReturnType<typeof api.game.getRoundProgress> | undefined;
type SubmitLine = (
  args: FunctionArgs<typeof api.game.submitLine>
) => Promise<FunctionReturnType<typeof api.game.submitLine> | undefined>;

function useDefaultCurrentAssignment(
  args: RoomQueryArgs
): CurrentAssignmentResult {
  return useQuery(api.game.getCurrentAssignment, args);
}

function useDefaultRoundProgress(args: RoomQueryArgs): RoundProgressResult {
  return useQuery(api.game.getRoundProgress, args);
}

function useDefaultSubmitLine(): SubmitLine {
  return useMutation(api.game.submitLine);
}

export interface WritingScreenDependencies {
  useRoomQueryArgs: typeof useRoomQueryArgs;
  useCurrentAssignment: typeof useDefaultCurrentAssignment;
  useRoundProgress: typeof useDefaultRoundProgress;
  useSubmitLine: () => SubmitLine;
  waitingScreenDependencies?: WaitingScreenDependencies;
}

const defaultDependencies: WritingScreenDependencies = {
  useRoomQueryArgs,
  useCurrentAssignment: useDefaultCurrentAssignment,
  useRoundProgress: useDefaultRoundProgress,
  useSubmitLine: useDefaultSubmitLine,
};

export interface WritingAssignment {
  poemId: Id<'poems'>;
  roomId: string;
  cycle: number;
  lineIndex: number;
  targetWordCount: number;
  totalRounds?: number;
  isFinalRound?: boolean;
  hasSubmitted: boolean;
  previousLineText?: string | null;
  roundStartedAt?: number;
}

interface WritingComposerProps {
  assignment: WritingAssignment;
  guestToken?: string | null;
  roomCode: string;
  dependencies: Pick<
    WritingScreenDependencies,
    'useSubmitLine' | 'waitingScreenDependencies'
  >;
}

function WritingComposer({
  assignment,
  guestToken,
  roomCode,
  dependencies,
}: WritingComposerProps) {
  const submitLine = dependencies.useSubmitLine();
  const draftKey = writingDraftKey(
    roomCode,
    assignment.poemId,
    assignment.lineIndex
  );
  const [text, setText] = useState(() =>
    normalizeLineText(readWritingDraft(draftKey))
  );
  const [draftWasRestored] = useState(() => text.length > 0);
  const [submissionState, setSubmissionState] = useState<
    'idle' | 'submitting' | 'retryable' | 'failed'
  >('idle');
  const [acknowledgement, setAcknowledgement] = useState('Your line is in.');
  const [browserOnline, setBrowserOnline] = useState(
    () => globalThis.navigator?.onLine ?? true
  );
  const [showWaitingScreen, setShowWaitingScreen] = useState(
    assignment.hasSubmitted
  );
  const [error, setError] = useState<string | null>(null);
  const [liveRegionMessage, setLiveRegionMessage] = useState('');
  const focusTimeoutRef = useRef<number | undefined>(undefined);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const currentWordCount = countWords(text);
  const targetCount = assignment.targetWordCount;
  const isValid = currentWordCount === targetCount;
  const isReadOnly = submissionState !== 'idle';
  const isReady = isValid && !isReadOnly;

  useEffect(() => {
    const handleOnline = () => setBrowserOnline(true);
    const handleOffline = () => setBrowserOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    saveWritingDraft(draftKey, text);
  }, [draftKey, text]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const difference = targetCount - currentWordCount;
      setLiveRegionMessage(
        isValid
          ? 'Ready to submit'
          : currentWordCount === 0
            ? ''
            : `${difference > 0 ? 'Add' : 'Remove'} ${Math.abs(difference)} word${Math.abs(difference) === 1 ? '' : 's'}`
      );
    }, 500);
    return () => clearTimeout(timeout);
  }, [isValid, currentWordCount, targetCount]);

  useEffect(
    () => () => {
      window.clearTimeout(focusTimeoutRef.current);
    },
    []
  );

  useEffect(() => {
    if (assignment.hasSubmitted) clearWritingDraft(draftKey);
  }, [assignment.hasSubmitted, draftKey]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [assignment.poemId, assignment.lineIndex]);

  if (showWaitingScreen || assignment.hasSubmitted) {
    return (
      <WaitingScreen
        roomCode={roomCode}
        guestToken={guestToken}
        acknowledgement={acknowledgement}
        embedded
        dependencies={dependencies.waitingScreenDependencies}
      />
    );
  }

  const submit = async (isRetry = false) => {
    if (
      !isValid ||
      (isRetry
        ? submissionState !== 'retryable' || !browserOnline
        : submissionState !== 'idle')
    ) {
      return;
    }
    setSubmissionState('submitting');
    setError(null);
    try {
      const result = await submitLine({
        poemId: assignment.poemId,
        lineIndex: assignment.lineIndex,
        text: normalizeLineText(text),
        guestToken: guestToken || undefined,
      });
      setAcknowledgement(
        result?.status === 'already_submitted'
          ? 'Your line was already recorded.'
          : 'Your line is in.'
      );
      clearWritingDraft(draftKey);
      // Only the server acknowledgement advances the composer to waiting.
      setShowWaitingScreen(true);
      try {
        if (assignment.roomId) {
          trackLineSubmitted({
            roomIdHash: hashRoomId(assignment.roomId),
            cycle: assignment.cycle,
            round: assignment.lineIndex,
          });
        }
      } catch {
        // Telemetry cannot turn an accepted line into a failed submission.
      }
    } catch (cause) {
      const reportable = toErrorReportable(cause);
      captureError(reportable, { roomCode, poemId: assignment.poemId });
      setSubmissionState(isRetry ? 'failed' : 'retryable');
      setError(
        `${errorToFeedback(reportable).message} ${
          isRetry
            ? 'Your draft is saved. Reconnect, then reload the room to check whether your line was recorded.'
            : 'Your draft is safe. Reconnect, then retry once.'
        }`
      );
    }
  };

  return (
    <div className="grid min-h-0 flex-1 content-start grid-rows-[minmax(0,auto)_auto] overflow-hidden">
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
        className="lj-safe-inline min-h-0 overflow-x-hidden overflow-y-auto overscroll-contain py-3 [--lj-safe-inline-space:1rem] md:py-8"
      >
        <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
          <RoundProgress
            round={assignment.lineIndex + 1}
            total={assignment.totalRounds}
          />
          {draftWasRestored && (
            <p aria-live="polite" className="text-sm text-text-secondary">
              Draft restored
            </p>
          )}
          {assignment.previousLineText && (
            <div data-testid={E2E_TEST_IDS.writingCarriedLine}>
              <p className="mb-1 text-sm text-text-secondary">Previous line</p>
              <p className="break-words text-lg font-sans leading-snug text-text-primary [overflow-wrap:anywhere] md:text-2xl">
                {assignment.previousLineText}
              </p>
            </div>
          )}
          {isReadOnly && (
            <p
              id="writing-confirmation"
              className="text-sm text-text-secondary"
            >
              This line stays read-only until the room confirms whether it was
              recorded.
            </p>
          )}
          <textarea
            ref={textareaRef}
            data-testid={E2E_TEST_IDS.writingLineInput}
            className="field-sizing-content min-h-[72px] max-h-[168px] w-full min-w-0 resize-none rounded-md border border-border bg-surface p-3 font-sans text-xl leading-snug text-text-primary outline-none [overflow-wrap:anywhere] focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-focus-ring md:p-5 md:text-2xl"
            placeholder="Your line…"
            value={text}
            readOnly={isReadOnly}
            onChange={(event) => {
              if (isReadOnly) return;
              setText(event.target.value.replace(/[\r\n]+/g, ' '));
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.preventDefault();
            }}
            onFocus={() => {
              window.clearTimeout(focusTimeoutRef.current);
              focusTimeoutRef.current = window.setTimeout(() => {
                textareaRef.current?.scrollIntoView({
                  behavior: 'auto',
                  block: 'center',
                });
                focusTimeoutRef.current = undefined;
              }, 300);
            }}
            rows={2}
            maxLength={500}
            inputMode="text"
            autoCapitalize="sentences"
            autoCorrect="on"
            enterKeyHint="done"
            wrap="soft"
            aria-label={`Write your line for round ${assignment.lineIndex + 1}. Target: ${targetCount} ${targetCount === 1 ? 'word' : 'words'}.`}
            aria-required="true"
            aria-invalid={currentWordCount > targetCount}
            aria-describedby={
              isReadOnly ? 'word-slots writing-confirmation' : 'word-slots'
            }
          />
          {text.length >= 450 && (
            <p className="text-sm text-text-secondary">
              {text.length}/500 characters
            </p>
          )}
          {(submissionState === 'retryable' ||
            submissionState === 'failed') && (
            <Alert variant="error">
              <p>{error}</p>
              {submissionState === 'retryable' && (
                <Button
                  type="button"
                  onClick={() => void submit(true)}
                  disabled={!browserOnline}
                  variant="secondary"
                  className="mt-3"
                >
                  {browserOnline ? 'Retry once' : 'Waiting for connection…'}
                </Button>
              )}
              {submissionState === 'failed' && (
                <Button
                  type="button"
                  onClick={() => window.location.reload()}
                  disabled={!browserOnline}
                  variant="secondary"
                  className="mt-3"
                >
                  Reload room
                </Button>
              )}
            </Alert>
          )}
        </div>
      </div>
      <div
        data-testid={E2E_TEST_IDS.writingActionZone}
        className="lj-safe-inline bg-background pt-2 pb-[max(12px,env(safe-area-inset-bottom))] [--lj-safe-inline-space:1rem]"
      >
        <div className="mx-auto flex max-w-xl flex-wrap items-center justify-between gap-3">
          <output
            id="word-slots"
            data-testid={E2E_TEST_IDS.writingWordSlots}
            aria-label={`${currentWordCount} of ${targetCount} words`}
            aria-live="off"
            className={cn(
              'shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums',
              currentWordCount > targetCount
                ? 'text-error'
                : 'text-text-secondary'
            )}
          >
            <span className="block">
              {currentWordCount} / {targetCount}
            </span>
            <span className="block text-xs font-normal">
              {targetCount === 1 ? 'word' : 'words'}
            </span>
          </output>
          <Button
            onClick={() => void submit()}
            data-testid={E2E_TEST_IDS.writingSubmitLineButton}
            data-ready={isReady ? 'true' : undefined}
            disabled={!isReady}
            className="min-h-[44px] min-w-[112px] px-[20px] py-[10px]"
          >
            {submissionState === 'submitting'
              ? 'Submitting…'
              : submissionState === 'failed'
                ? 'Unable to confirm'
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
  dependencies = defaultDependencies,
}: WritingScreenProps) {
  const { guestToken, shouldSkip, queryArgs } =
    dependencies.useRoomQueryArgs(roomCode);
  const assignment = dependencies.useCurrentAssignment(queryArgs);
  const roundProgress = dependencies.useRoundProgress(
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
          isLateJoiner={roundProgress?.isCurrentUserSpectator ?? false}
          embedded
          dependencies={dependencies.waitingScreenDependencies}
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
        roomCode={roomCode}
        dependencies={dependencies}
      />
    </div>
  );
}
