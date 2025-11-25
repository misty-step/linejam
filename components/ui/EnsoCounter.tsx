import { cn } from '@/lib/utils';

interface EnsoCounterProps {
  current: number;
  target: number;
  className?: string;
}

export function EnsoCounter({ current, target, className }: EnsoCounterProps) {
  const progress = target > 0 ? (current / target) * 100 : 0;
  const isValid = current === target;
  const isOver = current > target;

  // Circular progress (0-360 degrees)
  const circumference = 2 * Math.PI * 20; // r=20
  const strokeOffset = circumference - (progress / 100) * circumference;

  return (
    <div className={cn('relative w-16 h-16', className)}>
      {/* Background circle */}
      <svg className="w-full h-full -rotate-90" viewBox="0 0 48 48">
        <circle
          cx="24"
          cy="24"
          r="20"
          fill="none"
          stroke="var(--color-border)"
          strokeWidth="2"
        />

        {/* Progress circle */}
        <circle
          cx="24"
          cy="24"
          r="20"
          fill="none"
          stroke={
            isOver
              ? 'var(--color-error)'
              : isValid
                ? 'var(--color-success)'
                : 'var(--color-text-muted)'
          }
          strokeWidth="2"
          strokeDasharray={circumference}
          strokeDashoffset={strokeOffset}
          strokeLinecap="round"
          className={cn(
            'transition-all duration-300',
            isValid && 'animate-breathe'
          )}
        />
      </svg>

      {/* Count text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={cn(
            'text-sm font-mono font-medium',
            isValid && 'text-[var(--color-success)]',
            isOver && 'text-[var(--color-error)]',
            !isValid && !isOver && 'text-[var(--color-text-secondary)]'
          )}
        >
          {current}
        </span>
        <span className="text-[10px] font-mono text-[var(--color-text-muted)]">
          / {target}
        </span>
      </div>
    </div>
  );
}
