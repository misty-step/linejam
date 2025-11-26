import { cn } from '@/lib/utils';

/**
 * Stamp component for Japanese hanko seal metaphor
 *
 * Variants:
 * - 'hanko': Host marker (詩 character) - used in Lobby
 * - 'sealed': Submission marker (square with SEALED text) - used in WaitingScreen
 *
 * Note: 'approved' variant removed (unused). Add back if needed for future features.
 */
interface StampProps {
  type: 'hanko' | 'sealed';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Stamp({ type, size = 'md', className }: StampProps) {
  const sizeClass =
    size === 'sm' ? 'w-8 h-8' : size === 'lg' ? 'w-16 h-16' : 'w-12 h-12';

  return (
    <div
      className={cn(
        'inline-block -rotate-[5deg] drop-shadow-[3px_3px_8px_rgba(232,93,43,0.4)]',
        sizeClass,
        className
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 100 100" fill="none">
        {type === 'sealed' ? (
          <rect
            x="10"
            y="10"
            width="80"
            height="80"
            fill="var(--color-primary)"
            opacity="0.9"
          />
        ) : (
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="var(--color-primary)"
            opacity="0.9"
          />
        )}

        {type === 'hanko' && (
          <text
            x="50"
            y="65"
            textAnchor="middle"
            fontSize="40"
            fontFamily="serif"
            fill="var(--color-text-inverse)"
            fontWeight="bold"
          >
            詩
          </text>
        )}

        {type === 'sealed' && (
          <text
            x="50"
            y="40"
            textAnchor="middle"
            fontSize="16"
            fontFamily="monospace"
            fill="var(--color-text-inverse)"
          >
            SEALED
          </text>
        )}
      </svg>
    </div>
  );
}
