/**
 * AuthorDots: Visual representation of poem contributors
 *
 * Renders one quiet dot per unique author. Players never get per-player
 * colors (DESIGN.md [D1-2.4]); the count is the information.
 */

import { cn } from '@/lib/utils';

interface AuthorDotsProps {
  /** Stable IDs for all authors in the poem */
  authorStableIds: string[];
  /** Optional className for container */
  className?: string;
  /** Size of dots */
  size?: 'sm' | 'md' | 'lg';
  /** Maximum dots to show before "+N" */
  maxVisible?: number;
}

const SIZE_CONFIG = {
  sm: { dot: 6, gap: 2, fontSize: '0.625rem' },
  md: { dot: 8, gap: 3, fontSize: '0.75rem' },
  lg: { dot: 10, gap: 4, fontSize: '0.875rem' },
} as const;

export function AuthorDots({
  authorStableIds,
  className,
  size = 'sm',
  maxVisible = 5,
}: AuthorDotsProps) {
  const config = SIZE_CONFIG[size];
  const uniqueIds = [...new Set(authorStableIds)];
  const visibleIds = uniqueIds.slice(0, maxVisible);
  const overflowCount = uniqueIds.length - maxVisible;

  return (
    <div
      className={cn('flex items-center', className)}
      style={{ gap: `${config.gap}px` }}
      aria-label={`${uniqueIds.length} contributor${uniqueIds.length !== 1 ? 's' : ''}`}
      role="group"
    >
      {visibleIds.map((stableId, index) => {
        return (
          <div
            key={stableId}
            className="rounded-full bg-[var(--ink-muted)]"
            style={{
              width: `${config.dot}px`,
              height: `${config.dot}px`,
            }}
            title={`Contributor ${index + 1}`}
          />
        );
      })}
      {overflowCount > 0 && (
        <span
          className="text-[var(--color-text-muted)]"
          style={{ fontSize: config.fontSize }}
        >
          +{overflowCount}
        </span>
      )}
    </div>
  );
}
