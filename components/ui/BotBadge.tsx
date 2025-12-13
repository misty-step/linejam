import { Bot } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * BotBadge — AI Player Indicator
 *
 * Visual badge to distinguish AI players from humans.
 * Uses the same visual language as HostBadge for consistency.
 */

interface BotBadgeProps {
  className?: string;
  showLabel?: boolean;
}

export function BotBadge({ className, showLabel = true }: BotBadgeProps) {
  return (
    <div
      role="status"
      aria-label="AI player"
      className={cn(
        // Layout
        'inline-flex items-center gap-1.5 px-2 py-1',

        // Background & Border
        'bg-[var(--color-text-muted)]/5 border border-[var(--color-text-muted)]/20',
        'dark:bg-[var(--color-text-muted)]/10 dark:border-[var(--color-text-muted)]/30',

        // Shape & Shadow
        'rounded-[var(--radius-sm)]',
        'shadow-[var(--shadow-sm)]',

        className
      )}
    >
      {/* Bot Icon - Lucide */}
      <Bot
        className="w-3.5 h-3.5 text-[var(--color-text-muted)]"
        aria-hidden="true"
      />

      {/* Text Label */}
      {showLabel && (
        <span className="text-[10px] font-medium tracking-[var(--tracking-wide)] text-[var(--color-text-muted)] uppercase font-[var(--font-sans)]">
          AI
        </span>
      )}
    </div>
  );
}
