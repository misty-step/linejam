/**
 * LoadingState - Deep Module for Contextual Loading Messages
 *
 * Philosophy (Ousterhout): Hides animation complexity behind simple message interface.
 * Callers pass semantic loading message, module handles pulsing animation + typography.
 *
 * Why strategic: Adding new loading states is trivial (use existing component with new message).
 * Changing animation/styling centralized. No scattered "Loading..." text across codebase.
 *
 * Interface: <LoadingState message="..." />
 * Implementation: Pulsing persimmon dot + editorial typography (hidden from callers)
 */

interface LoadingStateProps {
  /** Contextual loading message (poetic, specific to operation) */
  message: string;
  /** Optional className for layout positioning */
  className?: string;
}

/**
 * Preset loading messages for common operations.
 * Centralized message constants ensure consistency and ease updates.
 */
export const LoadingMessages = {
  /** Room data fetch / player sync */
  LOADING_ROOM: 'Preparing your writing desk...',
  /** Poem reveal phase initialization */
  UNSEALING_POEMS: 'Unsealing the poems...',
  /** Room creation in progress */
  SETTING_UP_ROOM: 'Setting up your room...',
  /** Joining session */
  JOINING_SESSION: 'Joining the session...',
  /** Generic fallback */
  LOADING: 'Loading...',
} as const;

/**
 * Contextual loading state component with pulsing persimmon dot.
 *
 * @example
 * ```tsx
 * <LoadingState message={LoadingMessages.PREPARING_DESK} />
 * <LoadingState message="Custom loading message..." />
 * ```
 */
export function LoadingState({ message, className = '' }: LoadingStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-4 ${className}`}
    >
      {/* Pulsing persimmon dot */}
      <div className="flex items-center justify-center">
        <div className="w-3 h-3 bg-[var(--color-primary)] rounded-full animate-pulse" />
      </div>

      {/* Editorial typography message */}
      <p className="text-lg font-[var(--font-display)] text-[var(--color-text-secondary)] italic">
        {message}
      </p>
    </div>
  );
}
