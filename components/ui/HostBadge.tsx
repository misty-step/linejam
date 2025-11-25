import { Crown } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * HostBadge — Editorial Authority Marker
 *
 * Replaces Japanese hanko stamp with universal crown + label badge.
 * Inline horizontal badge for immediate recognition without cultural specificity.
 */

interface HostBadgeProps {
  className?: string;
}

export function HostBadge({ className }: HostBadgeProps) {
  return (
    <div
      role="status"
      aria-label="Room host"
      className={cn(
        // Layout
        'inline-flex items-center gap-2 px-2 py-1',

        // Background & Border
        'bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/20',
        'dark:bg-[var(--color-primary)]/10 dark:border-[var(--color-primary)]/30',

        // Shape & Shadow
        'rounded-[var(--radius-sm)]',
        'shadow-[1px_1px_0px_rgba(232,93,43,0.15)]',

        className
      )}
    >
      {/* Crown Icon - Lucide */}
      <Crown
        className="w-4 h-4 text-[var(--color-primary)]"
        aria-hidden="true"
      />

      {/* Text Label */}
      <span className="text-xs font-medium tracking-wide text-[var(--color-primary)] uppercase font-[var(--font-sans)]">
        HOST
      </span>
    </div>
  );
}
