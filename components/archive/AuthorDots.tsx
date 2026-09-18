/**
 * AuthorDots: Visual representation of poem contributors
 *
 * Renders colored dots for each unique author, using the established
 * avatar color system for consistency with PoemDisplay.
 */

import { cn } from '@/lib/utils';
import { getUniqueColor } from '@/lib/avatarColor';

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
        const color = getUniqueColor(stableId, uniqueIds);

        return (
          <div
            key={stableId}
            className="rounded-full"
            style={{
              width: `${config.dot}px`,
              height: `${config.dot}px`,
              backgroundColor: color,
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

/**
 * AuthorDotsInline: Compact contributors for narrow metadata rows.
 */
export function AuthorDotsInline({
  authorStableIds,
  className,
}: Pick<AuthorDotsProps, 'authorStableIds' | 'className'>) {
  if (authorStableIds.length === 0) return null;

  return <AuthorDots authorStableIds={authorStableIds} className={className} />;
}
