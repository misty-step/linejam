/**
 * ArchiveStats: Vertical stats list with icons
 *
 * Quiet metadata display - one stat per line, small font, icon anchors.
 * Kenya Hara minimalism: information without visual weight.
 */

import { ScrollText, Heart, Users, PenLine } from 'lucide-react';
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

interface StatLineProps {
  icon: React.ReactNode;
  value: number;
  label: string;
  accent?: boolean;
}

function StatLine({ icon, value, label, accent = false }: StatLineProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 text-sm font-mono',
        accent
          ? 'text-[var(--color-primary)]'
          : 'text-[var(--color-text-muted)]'
      )}
    >
      {icon}
      <span className="tabular-nums">{value.toLocaleString()}</span>
      <span>{label}</span>
    </div>
  );
}

/**
 * ArchiveStats component
 *
 * Vertical list of stats with icons - quiet, marginalia-style.
 */
export function ArchiveStats({ stats, className }: ArchiveStatsProps) {
  const iconClass = 'w-4 h-4';

  return (
    <div
      className={cn('flex flex-col gap-1.5', className)}
      role="region"
      aria-label="Archive statistics"
    >
      <StatLine
        icon={<ScrollText className={iconClass} />}
        value={stats.totalPoems}
        label={stats.totalPoems === 1 ? 'poem' : 'poems'}
        accent
      />
      <StatLine
        icon={<Heart className={iconClass} />}
        value={stats.totalFavorites}
        label={stats.totalFavorites === 1 ? 'favorite' : 'favorites'}
      />
      <StatLine
        icon={<Users className={iconClass} />}
        value={stats.uniqueCollaborators}
        label={
          stats.uniqueCollaborators === 1 ? 'collaborator' : 'collaborators'
        }
      />
      <StatLine
        icon={<PenLine className={iconClass} />}
        value={stats.totalLinesWritten}
        label={stats.totalLinesWritten === 1 ? 'line written' : 'lines written'}
      />
    </div>
  );
}

/**
 * ArchiveStatsSkeleton: Loading placeholder
 */
export function ArchiveStatsSkeleton() {
  return (
    <div className="flex flex-col gap-1.5 animate-pulse">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-4 h-4 bg-[var(--color-muted)] rounded" />
          <div className="h-4 w-24 bg-[var(--color-muted)] rounded" />
        </div>
      ))}
    </div>
  );
}
