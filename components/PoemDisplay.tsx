'use client';

import { Fragment, useEffect, useState } from 'react';
import { Button } from './ui/Button';
import { Ornament } from './ui/Ornament';
import { cn } from '@/lib/utils';

/**
 * PoemDisplay: Ceremonial Reveal Animation
 *
 * Timing Philosophy:
 * This component uses exceptionally slow animation durations (800ms, 1000ms)
 * that deliberately break the standard design token timing:
 *
 * - Line reveal: 800ms (vs standard 250ms)
 * - Button fade: 1000ms (vs standard 250ms)
 *
 * Why ceremonial timing?
 * - Context: This is the ONLY moment users see the complete collaborative poem
 * - Purpose: Create anticipation and weight for each line's appearance
 * - Metaphor: Unsealing a scroll, not clicking through UI
 * - Trade-off: Sacrifices efficiency for emotional impact
 *
 * These durations are intentional exceptions, not technical debt.
 * Do not "fix" them to match --duration-normal.
 */

const ORNAMENT_AFTER_LINE = 5;

interface PoemDisplayProps {
  lines: string[];
  onDone: () => void;
  alreadyRevealed?: boolean;
}

export function PoemDisplay({
  lines,
  onDone,
  alreadyRevealed = false,
}: PoemDisplayProps) {
  const [revealedCount, setRevealedCount] = useState(
    alreadyRevealed ? lines.length : 0
  );

  // Staggered reveal animation
  useEffect(() => {
    if (!alreadyRevealed && revealedCount < lines.length) {
      const timer = setTimeout(() => {
        setRevealedCount((prev) => prev + 1);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [revealedCount, lines.length, alreadyRevealed]);

  const allRevealed = revealedCount >= lines.length;

  return (
    <div className="fixed inset-0 bg-[var(--color-background)] z-50 flex flex-col items-center justify-center p-8 md:p-12 overflow-y-auto">
      <div className="max-w-2xl w-full space-y-12 relative z-10 my-auto">
        {/* The Poem */}
        <div className="space-y-6 flex flex-col">
          {lines.map((line, index) => {
            const isVisible = index < revealedCount;
            const isFirst = index === 0;

            // Alternate alignment: left, center, right
            const alignment = ['text-left', 'text-center', 'text-right'][
              index % 3
            ];

            return (
              <Fragment key={index}>
                <div
                  className={cn(
                    'transition-all duration-800 transform',
                    alignment,
                    isVisible
                      ? 'opacity-100 translate-y-0'
                      : 'opacity-0 translate-y-8'
                  )}
                >
                  <p
                    className={cn(
                      'font-[var(--font-display)] leading-tight text-[var(--color-text-primary)]',
                      isFirst
                        ? 'text-5xl first-letter:text-8xl first-letter:text-[var(--color-primary)] first-letter:float-left first-letter:pr-4 first-letter:leading-none'
                        : 'text-3xl md:text-4xl lg:text-5xl'
                    )}
                  >
                    {line}
                  </p>
                </div>
                {index === ORNAMENT_AFTER_LINE - 1 && isVisible && (
                  <div className="flex justify-center py-4">
                    <Ornament type="asterism" />
                  </div>
                )}
              </Fragment>
            );
          })}
        </div>

        {/* Done button */}
        <div
          className={cn(
            'text-center transition-opacity duration-1000',
            allRevealed ? 'opacity-100' : 'opacity-0'
          )}
        >
          <Button
            onClick={onDone}
            variant="outline"
            size="lg"
            className="min-w-[200px] border-2 h-16 text-lg"
          >
            Close Ledger
          </Button>
        </div>
      </div>
    </div>
  );
}
