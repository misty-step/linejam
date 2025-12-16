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

        // Background & Border - use theme utilities
        'bg-primary/5 border border-primary/20',
        'dark:bg-primary/10 dark:border-primary/30',

        // Shape & Shadow
        'rounded-sm shadow-sm',

        className
      )}
    >
      {/* Crown Icon - Lucide */}
      <Crown className="w-4 h-4 text-primary" aria-hidden="true" />

      {/* Text Label */}
      <span className="text-xs font-medium tracking-wide text-primary uppercase font-sans">
        HOST
      </span>
    </div>
  );
}
