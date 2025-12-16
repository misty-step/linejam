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

        // Background & Border - use theme utilities
        'bg-text-muted/5 border border-text-muted/20',
        'dark:bg-text-muted/10 dark:border-text-muted/30',

        // Shape & Shadow
        'rounded-sm shadow-sm',

        className
      )}
    >
      {/* Bot Icon - Lucide */}
      <Bot className="w-3.5 h-3.5 text-text-muted" aria-hidden="true" />

      {/* Text Label */}
      {showLabel && (
        <span className="text-[10px] font-medium tracking-wide text-text-muted uppercase font-sans">
          AI
        </span>
      )}
    </div>
  );
}
