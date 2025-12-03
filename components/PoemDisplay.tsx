'use client';

import { Fragment, useEffect, useState } from 'react';
import { Button } from './ui/Button';
import { cn } from '@/lib/utils';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { captureError } from '@/lib/sentry';

/**
 * PoemDisplay: The Galley (Editorial Reveal)
 *
 * Design Refinements (Gemini-guided):
 * - Grid Layout: Rigid [2.5rem_1fr] architecture for perfect vertical rhythm
 * - Hanko Seal: Persimmon circle replaces generic section mark
 * - Zero-latency reveal: React timing + CSS motion (no animation-delay conflict)
 * - Ma (Negative Space): Removed mid-poem ornaments for cleaner flow
 *
 * Timing Philosophy:
 * - Base reveal: 1000ms between lines (very slow, ceremonial)
 * - Wipe animation: 800ms per line (deliberate unveiling)
 * - Pause after line 4: 1200ms breath (the turn)
 * - Button fade: 1000ms
 * - Hanko stamp: 500ms bounce animation
 * - Total reveal time: ~11 seconds (9 lines + pause)
 */

const BASE_REVEAL_DELAY = 1000; // ms per line (very slow, ceremonial)
const PAUSE_AFTER_LINE = 4; // Add extra delay after this line (the turn)
const PAUSE_DURATION = 1200; // ms (extended breath at the turn)

interface PoemDisplayProps {
  poemId: Id<'poems'>;
  lines: string[];
  onDone: () => void;
  alreadyRevealed?: boolean;
}

export function PoemDisplay({
  poemId,
  lines,
  onDone,
  alreadyRevealed = false,
}: PoemDisplayProps) {
  const [revealedCount, setRevealedCount] = useState(
    alreadyRevealed ? lines.length : 0
  );
  const [copied, setCopied] = useState(false);
  const logShare = useMutation(api.shares.logShare);

  // Staggered reveal with rhythmic pause after line 4
  useEffect(() => {
    if (!alreadyRevealed && revealedCount < lines.length) {
      // Calculate delay: base delay + extra pause after line 4 (only when revealing line 5)
      const extraDelay =
        revealedCount === PAUSE_AFTER_LINE + 1 ? PAUSE_DURATION : 0;
      const delay = BASE_REVEAL_DELAY + extraDelay;

      const timer = setTimeout(() => {
        setRevealedCount((prev) => prev + 1);
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [revealedCount, lines.length, alreadyRevealed]);

  const handleShare = async () => {
    const url = `${window.location.origin}/poem/${poemId}`;

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      // Fire-and-forget analytics
      logShare({ poemId }).catch(() => {});
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      captureError(err, { operation: 'sharePoem', poemId });
    }
  };

  const allRevealed = revealedCount >= lines.length;

  return (
    <div className="fixed inset-0 bg-[var(--color-background)] z-50 flex flex-col items-start justify-center p-4 md:p-8 lg:p-12 overflow-y-auto">
      {/* Paper Document Container */}
      <div
        className={cn(
          'relative w-full max-w-2xl my-auto',
          'ml-0 md:ml-[10vw] lg:ml-[20vw]',
          'bg-[var(--color-surface)] p-8 md:p-12 lg:p-16',
          'shadow-[8px_8px_0px_rgba(232,93,43,0.15)]',
          'border border-[var(--color-border)]'
        )}
      >
        {/* The Poem - Grid Layout */}
        <div className="relative space-y-4">
          {lines.map((line, index) => {
            const isVisible = index < revealedCount;
            const lineNumber = (index + 1).toString().padStart(2, '0');

            return (
              <Fragment key={index}>
                {/* Grid: [Line Number column] [Text column] */}
                <div className="grid grid-cols-[2.5rem_1fr] md:grid-cols-[3rem_1fr] gap-4 md:gap-6 items-baseline">
                  {/* Line Number - Right Aligned in Gutter */}
                  <div
                    className={cn(
                      'font-mono text-sm text-right select-none',
                      'transition-opacity duration-500',
                      isVisible ? 'opacity-100' : 'opacity-0',
                      index === 0
                        ? 'text-[var(--color-primary)]'
                        : 'text-[var(--color-text-muted)]'
                    )}
                  >
                    {lineNumber}
                  </div>

                  {/* Line Text - Clip Path Wipe */}
                  <p
                    className={cn(
                      'font-[var(--font-display)] leading-tight text-left',
                      'text-2xl md:text-3xl lg:text-4xl',
                      'text-[var(--color-text-primary)]'
                    )}
                    style={{
                      animation: isVisible
                        ? `wipe-reveal 800ms ease-out forwards`
                        : 'none',
                      clipPath: isVisible ? undefined : 'inset(0 100% 0 0)',
                    }}
                  >
                    {line}
                  </p>
                </div>
              </Fragment>
            );
          })}

          {/* End Mark: The Hanko (Seal) */}
          {allRevealed && (
            <div className="flex justify-end pt-10 md:pt-14">
              <div className="animate-stamp origin-center" aria-hidden="true">
                <div className="h-4 w-4 rounded-full bg-[var(--color-primary)] mix-blend-multiply opacity-90" />
              </div>
            </div>
          )}
        </div>

        {/* Footer / Actions */}
        <div
          className={cn(
            'flex flex-col sm:flex-row items-center justify-center gap-4 mt-16 transition-opacity duration-1000',
            allRevealed ? 'opacity-100' : 'opacity-0'
          )}
        >
          <Button
            onClick={handleShare}
            variant="primary"
            size="lg"
            className="min-w-[160px] h-14 text-lg"
            stampAnimate={copied}
            aria-label="Copy poem link to clipboard"
          >
            {copied ? 'Copied!' : 'Share This'}
          </Button>
          <Button
            onClick={onDone}
            variant="ghost"
            size="lg"
            className="min-w-[140px] h-14 text-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
