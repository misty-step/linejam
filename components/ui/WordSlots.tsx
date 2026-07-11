'use client';

import { cn } from '@/lib/utils';
import { E2E_TEST_IDS } from '@/lib/e2eTestIds';

interface WordSlotsProps {
  current: number;
  target: number;
  /**
   * The text currently being composed. When provided, filled slots render
   * as chips sized to their actual word (DESIGN.md Law 2: word slots
   * always grow with their word, clipping can never happen). Omit to fall
   * back to the legacy fixed-square rendering for callers that only track
   * a count.
   */
  text?: string;
  className?: string;
}

const MAX_OVERFLOW_DISPLAY = 10;

// Mirrors lib/wordCount's countWords tokenization so chips match the count
// exactly (same words, same order, same total).
function splitWords(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

// Chips are the signature element (DESIGN.md Law 2) — sized to read at
// arm's length, not a quiet caption next to the line being written.
const chipBase =
  'inline-flex items-center whitespace-nowrap rounded-md border px-3 md:px-4 h-8 md:h-10 text-sm md:text-base font-medium transition-colors duration-[var(--duration-fast)] motion-reduce:transition-none';

const emptySlotClasses =
  'h-8 md:h-10 min-w-8 md:min-w-10 shrink-0 rounded-md border border-[var(--color-border)] bg-transparent';

/**
 * Genkoyoushi (原稿用紙) word counter
 *
 * Displays the word-count constraint as a row of manuscript slots that fill
 * with "ink" as words are typed. When the composed text is known, filled
 * slots render as chips containing the actual word — sized to its content,
 * never clipped or truncated — with remaining slots staying small fixed
 * squares. Overflow words render as error-styled chips (capped for
 * performance, with a +N indicator beyond the cap).
 */
export function WordSlots({
  current,
  target,
  text,
  className,
}: WordSlotsProps) {
  const words = text !== undefined ? splitWords(text) : null;
  const activeCount = words ? words.length : current;
  const isValid = activeCount === target;
  const isOver = activeCount > target;
  const overflowCount = isOver ? activeCount - target : 0;
  const displayedOverflow = Math.min(overflowCount, MAX_OVERFLOW_DISPLAY);
  const extraOverflow = overflowCount - displayedOverflow;

  return (
    <div
      id="word-slots"
      data-testid={E2E_TEST_IDS.writingWordSlots}
      className={cn('flex flex-wrap items-center gap-1.5 md:gap-2', className)}
      role="status"
      aria-label={`${activeCount} of ${target} words`}
    >
      {words ? (
        <>
          {/* Target slots — filled ones show the typed word, sized to it */}
          {Array.from({ length: target }).map((_, i) => {
            const word = words[i];
            if (word === undefined) {
              return (
                <span key={i} data-slot="empty" className={emptySlotClasses} />
              );
            }
            return (
              <span
                key={i}
                data-slot="filled"
                className={cn(
                  chipBase,
                  isValid
                    ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-[var(--color-text-inverse)]'
                    : 'bg-[var(--color-foreground)] border-[var(--color-foreground)] text-[var(--color-text-inverse)]'
                )}
              >
                {word}
              </span>
            );
          })}

          {/* Overflow words (if over limit, capped for performance) */}
          {displayedOverflow > 0 &&
            words.slice(target, target + displayedOverflow).map((word, i) => (
              <span
                key={`over-${i}`}
                data-slot="overflow"
                className={cn(
                  chipBase,
                  'border-dashed border-[var(--color-error)] bg-[var(--color-error)]/10 text-[var(--color-error)]'
                )}
              >
                {word}
              </span>
            ))}
        </>
      ) : (
        <>
          {/* Legacy count-only rendering (no `text` supplied) */}
          {Array.from({ length: target }).map((_, i) => {
            const isFilled = i < current && i < target;
            return (
              <div
                key={i}
                className={cn(
                  'w-3 h-3 md:w-4 md:h-4 border transition-all',
                  'duration-[var(--duration-fast)] motion-reduce:transition-none',
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

          {/* Overflow slots (if over limit, capped for performance) */}
          {displayedOverflow > 0 &&
            Array.from({ length: displayedOverflow }).map((_, i) => (
              <div
                key={`over-${i}`}
                className={cn(
                  'w-3 h-3 md:w-4 md:h-4',
                  'border border-dashed',
                  'border-[var(--color-error)] bg-[var(--color-error)]/10'
                )}
              />
            ))}
        </>
      )}

      {/* +N indicator if overflow exceeds the display cap */}
      {extraOverflow > 0 && (
        <span className="ml-0.5 text-xs font-mono text-[var(--color-error)]">
          +{extraOverflow}
        </span>
      )}

      {/* "words" label — stays a quiet caption next to the loud chips */}
      <span
        className={cn(
          'ml-1.5 text-[10px] md:text-xs',
          'font-mono uppercase tracking-wider',
          'text-[var(--color-text-muted)]'
        )}
      >
        words
      </span>
    </div>
  );
}
