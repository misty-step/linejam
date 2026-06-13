'use client';

import { useRoundClock } from '@/hooks/useRoundClock';
import { ROUND_CLOCK_MS } from '@/convex/lib/gameRules';
import { cn } from '@/lib/utils';

interface RoundClockProps {
  roundStartedAt?: number;
  className?: string;
}

/**
 * A hairline that quietly drains over the round's soft window. It warms to
 * vermillion in the final stretch and settles when overtime arrives. It never
 * blocks submission — pressure, not punishment. Reduced-motion users get a
 * static bar (the width still reflects time, but it doesn't animate down).
 *
 * Kenya-Hara restraint: a single 2px rule, no numbers, no ticking.
 */
export function RoundClock({ roundStartedAt, className }: RoundClockProps) {
  const { fractionRemaining, isOvertime } = useRoundClock(
    roundStartedAt,
    ROUND_CLOCK_MS
  );

  if (roundStartedAt === undefined) return null;

  const warming = fractionRemaining <= 0.25;

  return (
    <div
      className={cn(
        'h-[2px] w-full bg-[var(--color-border-subtle)]',
        className
      )}
      role="presentation"
      aria-hidden="true"
    >
      <div
        className={cn(
          'h-full origin-left transition-[width,background-color] duration-1000 ease-linear motion-reduce:transition-none',
          warming || isOvertime
            ? 'bg-[var(--color-primary)]'
            : 'bg-[var(--color-text-muted)]'
        )}
        style={{
          width: isOvertime ? '100%' : `${fractionRemaining * 100}%`,
          opacity: isOvertime ? 0.35 : 1,
        }}
      />
    </div>
  );
}
