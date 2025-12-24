'use client';

import { cn } from '@/lib/utils';

interface WordSlotsProps {
  current: number;
  target: number;
  className?: string;
}

/**
 * Genkoyoushi (原稿用紙) word counter
 *
 * Displays word count as a row of manuscript squares that fill with "ink"
 * as words are typed. Inspired by Japanese manuscript paper.
 */
export function WordSlots({ current, target, className }: WordSlotsProps) {
  const isValid = current === target;
  const isOver = current > target;
  const overflowCount = isOver ? current - target : 0;

  return (
    <div
      id="word-slots"
      className={cn('flex items-center gap-1', className)}
      role="status"
      aria-label={`${current} of ${target} words`}
    >
      {/* Target slots */}
      {Array.from({ length: target }).map((_, i) => {
        const isFilled = i < current && i < target;
        return (
          <div
            key={i}
            className={cn(
              'w-3 h-3 md:w-4 md:h-4 border transition-all',
              'duration-[var(--duration-fast)]',
              isFilled
                ? isValid
                  ? 'bg-[var(--color-primary)] border-[var(--color-primary)]'
                  : 'bg-[var(--color-foreground)] border-[var(--color-foreground)]'
                : 'bg-transparent border-[var(--color-border)]'
            )}
            style={{
              transitionDelay: isFilled ? `${i * 30}ms` : '0ms',
            }}
          />
        );
      })}

      {/* Overflow slots (if over limit) */}
      {overflowCount > 0 &&
        Array.from({ length: overflowCount }).map((_, i) => (
          <div
            key={`over-${i}`}
            className={cn(
              'w-3 h-3 md:w-4 md:h-4',
              'border border-dashed',
              'border-[var(--color-error)] bg-[var(--color-error)]/10'
            )}
          />
        ))}

      {/* "words" label */}
      <span
        className={cn(
          'ml-1.5 text-[9px] md:text-[10px]',
          'font-mono uppercase tracking-wider',
          'text-[var(--color-text-muted)]'
        )}
      >
        words
      </span>
    </div>
  );
}
