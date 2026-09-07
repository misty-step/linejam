import { WORD_COUNTS } from '@/convex/lib/gameRules';

export function RoundProgress({
  round,
  total = WORD_COUNTS.length,
}: {
  round: number;
  total?: number;
}) {
  return (
    <div className="flex items-center gap-3 text-sm font-semibold text-text-secondary">
      <svg
        width="48"
        height="25"
        viewBox="0 0 48 25"
        aria-hidden="true"
        className="shrink-0"
      >
        {WORD_COUNTS.map((count, index) => (
          <rect
            key={index}
            x={index * 5.4}
            y={25 - count * 4.6}
            width="3.6"
            height={count * 4.6}
            rx="1.8"
            fill={
              index === round - 1
                ? 'var(--color-primary)'
                : 'var(--color-border)'
            }
          />
        ))}
      </svg>
      <span>
        Round {round} of {total}
      </span>
    </div>
  );
}
