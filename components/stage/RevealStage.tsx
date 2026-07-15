'use client';

import { useMemo, useState } from 'react';
import type { Id } from '@/convex/_generated/dataModel';
import { cn } from '@/lib/utils';
import { E2E_TEST_IDS } from '@/lib/e2eTestIds';
import { Alert } from '@/components/ui/Alert';
import { Avatar } from '@/components/ui/Avatar';
import { BotBadge } from '@/components/ui/BotBadge';
import { Button } from '@/components/ui/Button';
import { StageShell } from './StageShell';

interface RevealStagePoemSummary {
  _id: Id<'poems'>;
  indexInRoom: number;
  readerName: string;
  readerStableId: string;
  isRevealed: boolean;
}

interface RevealStageLine {
  text: string;
  authorName: string;
  authorStableId?: string;
  isBot?: boolean;
}

interface RevealStageReadablePoem extends RevealStagePoemSummary {
  preview: string;
  lines: RevealStageLine[];
  revealedAt?: number;
}

interface RevealStageAssignedPoem extends RevealStageReadablePoem {
  isForAi?: boolean;
  aiPersonaName?: string;
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
  onRevealPoem: (poemId: Id<'poems'>) => Promise<void>;
}

function poemNumber(poem: { indexInRoom: number }) {
  return (poem.indexInRoom + 1).toString().padStart(2, '0');
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
  const [revealedLineCount, setRevealedLineCount] = useState(0);

  const sortedPoems = useMemo(
    () => [...poems].sort((a, b) => a.indexInRoom - b.indexInRoom),
    [poems]
  );
  const sortedRevealedPoems = useMemo(
    () =>
      [...revealedPoems].sort(
        (a, b) => (b.revealedAt ?? 0) - (a.revealedAt ?? 0)
      ),
    [revealedPoems]
  );
  const assignedPoem = myPoems.find((poem) => !poem.isRevealed) ?? null;
  const readablePoem =
    assignedPoem ?? sortedRevealedPoems[0] ?? myPoems[0] ?? null;
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
    myPoems[0] ??
    sortedPoems.find((poem) => !poem.isRevealed) ??
    sortedPoems[0] ??
    null;
  const visibleLines = activePoem
    ? activePoem.lines.slice(0, revealedLineCount)
    : [];
  const canAdvance =
    activePoem !== null && revealedLineCount < activePoem.lines.length;

  const handleReadOnStage = async () => {
    if (!readablePoem) return;

    if (readableAssignedPoem) {
      await onRevealPoem(readablePoem._id);
    }

    setActivePoemId(readablePoem._id);
    setRevealedLineCount(Math.min(1, readablePoem.lines.length));
  };

  const handleAdvance = () => {
    if (!activePoem) return;

    if (canAdvance) {
      setRevealedLineCount((current) =>
        Math.min(current + 1, activePoem.lines.length)
      );
      return;
    }

    setActivePoemId(null);
    setRevealedLineCount(0);
  };

  return (
    <StageShell
      testId={E2E_TEST_IDS.revealPresentationStage}
      title="Reveal stage"
      subtitle="The reader controls the poem one line at a time."
      onExit={onExit}
    >
      <div className="grid min-h-full gap-10 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.42fr)] xl:items-stretch">
        <section className="flex min-h-0 flex-col justify-between border border-border bg-surface p-6 shadow-[var(--shadow-lg)] md:p-12">
          {headlinePoem ? (
            <div className="space-y-8">
              <div className="flex items-center gap-5">
                <Avatar
                  stableId={headlinePoem.readerStableId}
                  displayName={headlinePoem.readerName}
                  allStableIds={allStableIds}
                  size="xl"
                />
                <div>
                  <p className="text-xs font-mono uppercase tracking-[0.28em] text-primary">
                    Reader
                  </p>
                  <h2 className="text-[clamp(3.25rem,8vw,9rem)] font-[var(--font-display)] leading-[0.92] text-text-primary">
                    {headlinePoem.readerName} reads Poem{' '}
                    {poemNumber(headlinePoem)}
                  </h2>
                </div>
              </div>

              {activePoem ? (
                <div className="space-y-8">
                  {visibleLines.map((line, index) => (
                    <p
                      key={`${line.text}:${index}`}
                      className={cn(
                        'max-w-5xl font-[var(--font-display)] text-[clamp(2.4rem,5vw,6.25rem)] italic leading-[1.08] text-text-primary',
                        index === visibleLines.length - 1 &&
                          'animate-fade-in-up'
                      )}
                    >
                      {line.text}
                    </p>
                  ))}
                </div>
              ) : readablePoem ? (
                <div className="max-w-5xl space-y-5">
                  <p className="text-xs font-mono uppercase tracking-[0.28em] text-text-muted">
                    {readableAssignedPoem?.isFallbackReader
                      ? `Step in for ${readableAssignedPoem.readerName}`
                      : readableAssignedPoem
                        ? 'Ready on this device'
                        : 'Ready on stage'}
                  </p>
                  <p className="font-[var(--font-display)] text-[clamp(2.25rem,5vw,5.5rem)] italic leading-[1.1] text-text-secondary">
                    &ldquo;{readablePoem.preview}...&rdquo;
                  </p>
                  {readableAssignedPoem?.isForAi && (
                    <div className="flex items-center gap-3 text-primary">
                      <BotBadge />
                      <span className="text-lg">
                        Read for {readableAssignedPoem.aiPersonaName}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="max-w-3xl text-4xl text-text-secondary">
                  Waiting for the assigned reader to take the stage.
                </p>
              )}
            </div>
          ) : (
            <p className="text-4xl text-text-secondary">
              No poems are ready for reveal yet.
            </p>
          )}

          <div className="mt-10 space-y-4">
            {error && <Alert variant="error">{error}</Alert>}
            {activePoem ? (
              <Button
                type="button"
                onClick={handleAdvance}
                data-testid={E2E_TEST_IDS.revealStageNextLineButton}
                size="lg"
                className="min-h-16 w-full text-xl sm:w-auto sm:min-w-64"
              >
                {canAdvance ? 'Next line' : 'Finish poem'}
              </Button>
            ) : readablePoem ? (
              <Button
                type="button"
                onClick={handleReadOnStage}
                size="lg"
                className="min-h-16 w-full text-xl sm:w-auto sm:min-w-64"
                disabled={
                  !!readableAssignedPoem &&
                  isRevealingId === readableAssignedPoem._id
                }
              >
                {readableAssignedPoem &&
                isRevealingId === readableAssignedPoem._id
                  ? 'Unsealing...'
                  : readableAssignedPoem?.isFallbackReader
                    ? 'Step in on stage'
                    : readableAssignedPoem
                      ? 'Reveal on stage'
                      : 'Read on stage'}
              </Button>
            ) : null}
          </div>
        </section>

        <aside className="border border-border-subtle bg-background/70 p-6">
          <p className="mb-5 text-xs font-mono uppercase tracking-[0.28em] text-text-muted">
            Running order
          </p>
          <ol className="grid gap-2">
            {sortedPoems.map((poem) => {
              const isCurrent = headlinePoem?._id === poem._id;

              return (
                <li
                  key={poem._id}
                  className={cn(
                    'flex items-center justify-between gap-4 border-b border-border-subtle py-4',
                    poem.isRevealed && 'opacity-50'
                  )}
                >
                  <div className="min-w-0">
                    <p className="font-mono text-sm text-text-muted">
                      {poemNumber(poem)}
                    </p>
                    <p className="truncate text-2xl font-medium text-text-primary">
                      {poem.readerName}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-mono uppercase tracking-[0.16em]',
                      isCurrent
                        ? 'border-primary text-primary'
                        : 'border-border text-text-muted'
                    )}
                  >
                    {poem.isRevealed ? 'Read' : isCurrent ? 'Now' : 'Waiting'}
                  </span>
                </li>
              );
            })}
          </ol>
        </aside>
      </div>
    </StageShell>
  );
}
