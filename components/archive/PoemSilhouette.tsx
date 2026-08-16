/**
 * PoemSilhouette: Visual representation of a poem's structure
 *
 * Renders the 1-2-3-4-5-4-3-2-1 word count pattern as proportional bars,
 * creating a distinctive "diamond" silhouette unique to Linejam poems.
 *
 * Design: Stripe-inspired minimal visualization with purposeful animation.
 */

import { CSSProperties } from 'react';
import { cn } from '@/lib/utils';

export interface PoemSilhouetteProps {
  /** Word counts for each line (e.g., [1, 2, 3, 4, 5, 4, 3, 2, 1]) */
  wordCounts: number[];
  /** Optional className for container */
  className?: string;
  /** Whether to animate bars on mount */
  animate?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_CONFIG = {
  sm: { height: 2, gap: 1, maxWidth: 20 },
  md: { height: 3, gap: 1.5, maxWidth: 32 },
  lg: { height: 4, gap: 2, maxWidth: 48 },
} as const;

/**
 * PoemSilhouette component
 *
 * Deep module: Handles all complexity of visualization internally.
 * Simple interface: just pass wordCounts array.
 */
export function PoemSilhouette({
  wordCounts,
  className,
  animate = false,
  size = 'sm',
}: PoemSilhouetteProps) {
  const config = SIZE_CONFIG[size];
  const maxCount = Math.max(...wordCounts, 5); // Normalize to at least 5

  return (
    <div
      className={cn('flex flex-col items-center', className)}
      style={{ gap: `${config.gap}px` }}
      aria-label={`Poem silhouette: ${wordCounts.join('-')} words per line`}
      role="img"
    >
      {wordCounts.map((count, index) => {
        const widthPercent = (count / maxCount) * 100;
        const barStyle: CSSProperties = {
          height: `${config.height}px`,
          width: `${(widthPercent / 100) * config.maxWidth}px`,
          minWidth: '2px',
        };
        if (animate) {
          barStyle.animation = 'silhouette-bar-reveal 400ms ease-out forwards';
          barStyle.animationDelay = `${index * 50}ms`;
        }

        return (
          <div
            key={index}
            className={cn(
              'bg-[var(--color-text-muted)] rounded-full transition-all',
              animate && 'opacity-0'
            )}
            style={barStyle}
          />
        );
      })}
    </div>
  );
}

/**
 * PoemSilhouetteCompact: Horizontal inline variant for tight spaces
 */
export function PoemSilhouetteCompact({
  wordCounts,
  className,
}: Pick<PoemSilhouetteProps, 'wordCounts' | 'className'>) {
  const maxCount = Math.max(...wordCounts, 5);

  return (
    <div
      className={cn('flex items-end gap-px', className)}
      aria-label={`Poem silhouette`}
      role="img"
    >
      {wordCounts.map((count, index) => {
        const heightPercent = (count / maxCount) * 100;

        return (
          <div
            key={index}
            className="bg-[var(--color-text-muted)] rounded-sm"
            style={{
              width: '3px',
              height: `${Math.max(heightPercent * 0.12, 2)}px`,
            }}
          />
        );
      })}
    </div>
  );
}
