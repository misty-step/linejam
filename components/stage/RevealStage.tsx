'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Id } from '@/convex/_generated/dataModel';
import { cn } from '@/lib/utils';
import type { AvatarId } from '@/lib/avatars';
import { E2E_TEST_IDS } from '@/lib/e2eTestIds';
import { Alert } from '@/components/ui/Alert';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { StageShell } from './StageShell';

interface RevealStagePoemSummary {
  _id: Id<'poems'>;
  indexInRoom: number;
  readerName: string;
  readerStableId: string;
  readerAvatarId?: AvatarId;
  isRevealed: boolean;
}

interface RevealStageLine {
  text: string;
  authorName: string;
  authorStableId?: string;
}

interface RevealStageReadablePoem extends RevealStagePoemSummary {
  preview: string;
  lines: RevealStageLine[];
  revealedAt?: number;
}

interface RevealStageAssignedPoem extends RevealStageReadablePoem {
  isFallbackReader?: boolean;
}

interface RevealStageProps {
  poems: RevealStagePoemSummary[];
  myPoems: RevealStageAssignedPoem[];
  revealedPoems: RevealStageReadablePoem[];
  allStableIds: string[];
  error: string | null;
  isRevealingId: Id<'poems'> | null;
  onExit: () => void;
  onRevealPoem: (poemId: Id<'poems'>) => Promise<boolean>;
}

function poemNumber(poem: { indexInRoom: number }) {
  return String(poem.indexInRoom + 1);
}

export function RevealStage({
  poems,
  myPoems,
  revealedPoems,
  allStableIds,
  error,
  isRevealingId,
  onExit,
  onRevealPoem,
}: RevealStageProps) {
  const [activePoemId, setActivePoemId] = useState<Id<'poems'> | null>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);

  const sortedPoems = useMemo(
    () => [...poems].sort((a, b) => a.indexInRoom - b.indexInRoom),
    [poems]
  );
  const sortedRevealedPoems = useMemo(
    () => [...revealedPoems].sort((a, b) => a.indexInRoom - b.indexInRoom),
    [revealedPoems]
  );
  const sortedMyPoems = useMemo(
    () => [...myPoems].sort((a, b) => a.indexInRoom - b.indexInRoom),
    [myPoems]
  );
  const assignedPoem = sortedMyPoems.find((poem) => !poem.isRevealed) ?? null;
  const readablePoem =
    assignedPoem ?? sortedRevealedPoems[0] ?? sortedMyPoems[0] ?? null;
  const readableAssignedPoem =
    assignedPoem && readablePoem?._id === assignedPoem._id
      ? assignedPoem
      : null;
  const activePoem = activePoemId
    ? ([...myPoems, ...revealedPoems].find(
        (poem) => poem._id === activePoemId
      ) ?? null)
    : null;
  const headlinePoem =
    activePoem ??
    assignedPoem ??
    sortedRevealedPoems[0] ??
    sortedMyPoems[0] ??
    sortedPoems.find((poem) => !poem.isRevealed) ??
    sortedPoems[0] ??
    null;
  const headlinePoemId = headlinePoem?._id;
  const readingNowId =
    activePoem?._id ?? sortedPoems.find((poem) => !poem.isRevealed)?._id;
  const upNextId = sortedPoems.find(
    (poem) => !poem.isRevealed && poem._id !== readingNowId
  )?._id;
  useEffect(() => {
    if (!headlinePoemId) return;
    headlineRef.current?.focus();
  }, [activePoemId, headlinePoemId]);

  const announcement = activePoem
    ? 'Poem ' + poemNumber(activePoem) + ' revealed.'
    : headlinePoem
      ? headlinePoem.readerName +
        ' reads poem ' +
        poemNumber(headlinePoem) +
        '.'
      : '';

  const handleReadOnStage = async () => {
    if (!readablePoem) return;

    if (readableAssignedPoem) {
      const revealed = await onRevealPoem(readablePoem._id);
      if (!revealed) return;
    }

    setActivePoemId(readablePoem._id);
  };

  const handleFinish = () => {
    setActivePoemId(null);
  };

  return (
    <StageShell
      testId={E2E_TEST_IDS.revealPresentationStage}
      title="Reading circle"
      subtitle=""
      onExit={onExit}
    >
      <div className="grid gap-6 font-sans xl:grid-cols-[minmax(0,1fr)_minmax(16rem,0.4fr)] xl:items-start">
        <p role="status" aria-live="polite" className="sr-only">
          {announcement}
        </p>
        <section className="min-w-0 rounded-3xl bg-surface p-5 sm:p-8">
          {headlinePoem ? (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <Avatar
                  stableId={headlinePoem.readerStableId}
                  displayName={headlinePoem.readerName}
                  avatarId={headlinePoem.readerAvatarId}
                  allStableIds={allStableIds}
                  size="lg"
                />
                <h2
                  ref={headlineRef}
                  tabIndex={-1}
                  className="min-w-0 text-xl font-bold leading-snug text-text-primary [overflow-wrap:anywhere] focus:outline-none sm:text-2xl"
                >
                  {headlinePoem.readerName} reads poem{' '}
                  {poemNumber(headlinePoem)}
                </h2>
              </div>

              {activePoem ? (
                <ol aria-label="Poem lines" className="space-y-3">
                  {activePoem.lines.map((line, index) => (
                    <li
                      key={index}
                      className="grid items-baseline gap-x-6 md:grid-cols-[minmax(0,1fr)_minmax(5rem,0.3fr)]"
                    >
                      <p className="min-w-0 whitespace-pre-wrap text-xl not-italic leading-relaxed text-text-primary [overflow-wrap:anywhere] sm:text-2xl lg:text-3xl">
                        {line.text}
                      </p>
                      <span className="min-w-0 text-sm leading-relaxed text-text-secondary [overflow-wrap:anywhere]">
                        <span className="sr-only">Written by </span>
                        {line.authorName}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : readablePoem ? (
                <div className="space-y-3">
                  {readableAssignedPoem?.isFallbackReader && (
                    <p className="font-semibold text-primary">
                      Step in for {readableAssignedPoem.readerName}
                    </p>
                  )}
                  <p className="text-lg leading-relaxed text-text-secondary [overflow-wrap:anywhere] sm:text-xl">
                    {readablePoem.preview}…
                  </p>
                </div>
              ) : (
                <p className="text-lg text-text-secondary">
                  Waiting for {headlinePoem.readerName} to open their poem.
                </p>
              )}
            </div>
          ) : (
            <p className="text-lg text-text-secondary">
              No poems are ready yet.
            </p>
          )}

          <div className="mt-6 space-y-3">
            {error && <Alert variant="error">{error}</Alert>}
            {activePoem ? (
              <Button
                type="button"
                onClick={handleFinish}
                data-testid={E2E_TEST_IDS.revealStageNextLineButton}
                size="lg"
                className="min-h-12 w-full sm:w-auto sm:min-w-32"
              >
                Done
              </Button>
            ) : readablePoem ? (
              <Button
                type="button"
                onClick={handleReadOnStage}
                size="lg"
                className="min-h-12 w-full sm:w-auto"
                disabled={
                  !!readableAssignedPoem &&
                  isRevealingId === readableAssignedPoem._id
                }
              >
                {readableAssignedPoem &&
                isRevealingId === readableAssignedPoem._id
                  ? 'Opening...'
                  : readableAssignedPoem?.isFallbackReader
                    ? 'Step in and read'
                    : readableAssignedPoem
                      ? 'Read poem'
                      : 'Read again'}
              </Button>
            ) : null}
          </div>
        </section>

        <aside aria-labelledby="stage-reading-order-title" className="min-w-0">
          <h2
            id="stage-reading-order-title"
            className="mb-3 text-base font-bold text-text-primary"
          >
            Reading order
          </h2>
          <ol>
            {sortedPoems.map((poem) => {
              const isCurrent = readingNowId === poem._id;
              const status =
                activePoem?._id === poem._id
                  ? 'Reading now'
                  : poem.isRevealed
                    ? 'Read'
                    : isCurrent
                      ? 'Reading now'
                      : upNextId === poem._id
                        ? 'Up next'
                        : null;

              return (
                <li
                  key={poem._id}
                  aria-current={isCurrent ? 'true' : undefined}
                  className={cn(
                    'flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border-subtle px-3 py-3',
                    isCurrent && 'rounded-xl bg-surface'
                  )}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar
                      stableId={poem.readerStableId}
                      displayName={poem.readerName}
                      avatarId={poem.readerAvatarId}
                      allStableIds={allStableIds}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="font-semibold text-text-primary [overflow-wrap:anywhere]">
                        {poem.readerName}
                      </p>
                      <p className="text-sm text-text-secondary">
                        Poem {poemNumber(poem)}
                      </p>
                    </div>
                  </div>
                  {status && (
                    <span
                      className={cn(
                        'text-sm font-semibold',
                        isCurrent ? 'text-primary' : 'text-text-secondary'
                      )}
                    >
                      {status}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </aside>
      </div>
    </StageShell>
  );
}
