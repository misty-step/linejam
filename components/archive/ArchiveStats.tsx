/**
 * ArchiveStats: Summary statistics header
 *
 * Displays key metrics about the user's poetry collection.
 * Design: Stripe-inspired stat blocks with semantic grouping.
 */

import { cn } from '@/lib/utils';

interface ArchiveStatsProps {
  stats: {
    totalPoems: number;
    totalFavorites: number;
    uniqueCollaborators: number;
    totalLinesWritten: number;
  };
  className?: string;
}

interface StatBlockProps {
  label: string;
  value: number;
  accent?: boolean;
}

function StatBlock({ label, value, accent = false }: StatBlockProps) {
  return (
    <div className="flex flex-col">
      <span
        className={cn(
          'text-3xl md:text-4xl font-[var(--font-display)] tabular-nums',
          accent
            ? 'text-[var(--color-primary)]'
            : 'text-[var(--color-text-primary)]'
        )}
      >
        {value.toLocaleString()}
      </span>
      <span className="text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
        {label}
      </span>
    </div>
  );
}

/**
 * ArchiveStats component
 *
 * Deep module: Handles all stat formatting and layout.
 * Simple interface: just pass stats object.
 */
export function ArchiveStats({ stats, className }: ArchiveStatsProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap gap-8 md:gap-12 py-6',
        'border-y border-[var(--color-border-subtle)]',
        className
      )}
      role="region"
      aria-label="Archive statistics"
    >
      <StatBlock label="Poems" value={stats.totalPoems} accent />
      <StatBlock label="Favorites" value={stats.totalFavorites} />
      <StatBlock label="Collaborators" value={stats.uniqueCollaborators} />
      <StatBlock label="Lines Written" value={stats.totalLinesWritten} />
    </div>
  );
}

/**
 * ArchiveStatsSkeleton: Loading placeholder
 */
export function ArchiveStatsSkeleton() {
  return (
    <div className="flex flex-wrap gap-8 md:gap-12 py-6 border-y border-[var(--color-border-subtle)] animate-pulse">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex flex-col gap-1">
          <div className="h-10 w-16 bg-[var(--color-muted)] rounded" />
          <div className="h-3 w-20 bg-[var(--color-muted)] rounded" />
        </div>
      ))}
    </div>
  );
}
