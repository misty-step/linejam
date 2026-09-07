interface LoadingStateProps {
  /** The operation the player is waiting for. */
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
  LOADING_ROOM: 'Loading room…',
  /** Poem reveal phase initialization */
  UNSEALING_POEMS: 'Loading poems…',
  /** Room creation in progress */
  SETTING_UP_ROOM: 'Creating room…',
  /** Joining session */
  JOINING_SESSION: 'Joining room…',
  /** Generic fallback */
  LOADING: 'Loading…',
} as const;

export function LoadingState({ message, className = '' }: LoadingStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-4 ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex items-center justify-center" aria-hidden="true">
        <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent motion-safe:animate-spin" />
      </div>

      <p className="text-base font-sans text-text-secondary">{message}</p>
    </div>
  );
}
