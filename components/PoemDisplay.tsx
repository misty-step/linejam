'use client';

import { Fragment, useEffect, useState } from 'react';
import { Button } from './ui/Button';
import { cn } from '@/lib/utils';
import { Id } from '@/convex/_generated/dataModel';
import { useSharePoem } from '@/hooks/useSharePoem';
import { getUserColor, getUniqueColor } from '@/lib/avatarColor';

/**
 * PoemDisplay: The Hanko (Sigil) Approach
 *
 * Design:
 * - Full-screen immersive (no card)
 * - Colored dots represent authors (tap for name)
 * - Reduced typography for mobile reading
 * - Clean verse presentation
 */

const BASE_REVEAL_DELAY = 1000;
const PAUSE_AFTER_LINE = 4;
const PAUSE_DURATION = 1200;

export interface PoemLine {
  text: string;
  authorName?: string;
  authorStableId?: string;
  isBot?: boolean;
}

interface PoemDisplayProps {
  poemId: Id<'poems'>;
  lines: string[] | PoemLine[];
  onDone: () => void;
  alreadyRevealed?: boolean;
  allStableIds?: string[];
}

export function PoemDisplay({
  poemId,
  lines,
  onDone,
  alreadyRevealed = false,
  allStableIds,
}: PoemDisplayProps) {
  const [revealedCount, setRevealedCount] = useState(
    alreadyRevealed ? lines.length : 0
  );
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const { handleShare, copied } = useSharePoem(poemId);

  const normalizedLines: PoemLine[] = lines.map((line) =>
    typeof line === 'string' ? { text: line } : line
  );

  // Staggered reveal with rhythmic pause after line 4
  useEffect(() => {
    if (!alreadyRevealed && revealedCount < lines.length) {
      const extraDelay =
        revealedCount === PAUSE_AFTER_LINE + 1 ? PAUSE_DURATION : 0;
      const delay = BASE_REVEAL_DELAY + extraDelay;

      const timer = setTimeout(() => {
        setRevealedCount((prev) => prev + 1);
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [revealedCount, lines.length, alreadyRevealed]);

  // Clear selected line after 2s
  useEffect(() => {
    if (selectedLine !== null) {
      const timer = setTimeout(() => setSelectedLine(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [selectedLine]);

  const allRevealed = revealedCount >= lines.length;

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col overflow-y-auto">
      {/* Poem Content - Full screen, no card */}
      <div className="flex-1 px-6 md:px-12 lg:px-24 py-12 md:py-16 lg:py-24 max-w-3xl mx-auto w-full">
        {/* The Poem - Grid with dot gutter */}
        <div className="space-y-6">
          {normalizedLines.map((line, index) => {
            const isVisible = index < revealedCount;
            const isSelected = selectedLine === index;
            const dotColor = line.authorStableId
              ? allStableIds
                ? getUniqueColor(line.authorStableId, allStableIds)
                : getUserColor(line.authorStableId)
              : 'var(--color-text-muted)';

            return (
              <Fragment key={index}>
                <div className="grid grid-cols-[1rem_1fr] gap-4 items-center">
                  {/* Author Dot (Hanko) */}
                  <div
                    role="button"
                    tabIndex={isVisible ? 0 : -1}
                    className={cn(
                      'w-2 h-2 rounded-full cursor-pointer transition-all',
                      'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                      isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-0'
                    )}
                    style={{ backgroundColor: dotColor }}
                    onClick={() => setSelectedLine(index)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedLine(index);
                      }
                    }}
                    title={line.authorName}
                    aria-label={`Show author for line ${index + 1}`}
                  />

                  {/* Line Text */}
                  <div className="relative">
                    <p
                      className={cn(
                        'font-[var(--font-display)] leading-relaxed',
                        'text-lg md:text-xl lg:text-2xl',
                        'text-text-primary'
                      )}
                      style={{
                        animation: isVisible
                          ? `wipe-reveal 800ms ease-out forwards`
                          : 'none',
                        clipPath: isVisible ? undefined : 'inset(0 100% 0 0)',
                      }}
                    >
                      {line.text}
                    </p>

                    {/* Author byline on tap */}
                    {line.authorName && (
                      <span
                        className={cn(
                          'absolute top-full left-0 text-sm italic text-text-muted',
                          'transition-opacity duration-300',
                          isSelected ? 'opacity-100' : 'opacity-0'
                        )}
                      >
                        — {line.authorName}
                        {line.isBot && ' (AI)'}
                      </span>
                    )}
                  </div>
                </div>
              </Fragment>
            );
          })}
        </div>
      </div>

      {/* Footer / Actions - Fixed at bottom */}
      <div
        className={cn(
          'px-6 md:px-12 lg:px-24 py-6 border-t border-border-subtle',
          'flex items-center justify-center gap-4',
          'transition-opacity duration-500',
          allRevealed ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
      >
        <Button
          onClick={handleShare}
          variant="primary"
          size="lg"
          className="min-w-[140px] h-12"
          stampAnimate={copied}
        >
          {copied ? 'Copied!' : 'Share'}
        </Button>
        <Button
          onClick={onDone}
          variant="ghost"
          size="lg"
          className="min-w-[100px] h-12 text-text-muted hover:text-text-primary"
        >
          Close
        </Button>
      </div>
    </div>
  );
}
