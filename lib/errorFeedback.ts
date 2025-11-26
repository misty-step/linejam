/**
 * Error Feedback System — Deep Module for User-Facing Error Communication
 *
 * Philosophy (Ousterhout): This module hides error classification complexity behind a
 * simple interface. Callers don't need to know about network vs validation vs Convex
 * errors—they just get a user-friendly message.
 *
 * Why strategic: Adding new error patterns is trivial (edit one function). Changing
 * error messages is centralized. UI components stay simple.
 *
 * Interface: errorToFeedback(error) → { message, variant }
 * Implementation: Pattern matching + kind message generation (hidden from callers)
 */

export interface ErrorFeedback {
  /** User-friendly error message explaining what happened and how to fix it */
  message: string;
  /** Visual variant for Alert component */
  variant: 'error' | 'warning' | 'info';
}

/**
 * Transform any error into user-friendly feedback.
 *
 * Handles:
 * - Network failures (fetch, timeout)
 * - Convex validation errors (room not found, game already started)
 * - Rate limiting
 * - Generic fallback (helpful message even for unknown errors)
 *
 * @param error - Error from try/catch block (Error | unknown)
 * @returns Structured feedback ready for UI display
 *
 * @example
 * ```typescript
 * try {
 *   await createRoomMutation();
 * } catch (error) {
 *   const feedback = errorToFeedback(error);
 *   setError(feedback.message);
 * }
 * ```
 */
export function errorToFeedback(error: unknown): ErrorFeedback {
  // Extract error message from various error shapes
  const message = extractErrorMessage(error);

  // Pattern match common error types
  if (isNetworkError(message)) {
    return {
      message:
        'Unable to connect. Please check your internet connection and try again.',
      variant: 'error',
    };
  }

  if (isTimeoutError(message)) {
    return {
      message:
        'This is taking longer than expected. Please try again in a moment.',
      variant: 'error',
    };
  }

  if (isRoomNotFoundError(message)) {
    return {
      message: 'Room code not found. Please check the code and try again.',
      variant: 'error',
    };
  }

  if (isGameAlreadyStartedError(message)) {
    return {
      message:
        'This game has already started. Please wait for the next session or ask the host to create a new room.',
      variant: 'error',
    };
  }

  if (isRateLimitError(message)) {
    return {
      message:
        'Too many attempts. Please wait a few minutes before trying again.',
      variant: 'error',
    };
  }

  // Generic fallback (still helpful, not just "Error occurred")
  return {
    message:
      'An unexpected error occurred. Please try again. If the problem persists, try refreshing the page.',
    variant: 'error',
  };
}

// ============================================================================
// Private Helpers (Information Hiding)
// ============================================================================

/**
 * Extract error message from various error shapes.
 * Handles: Error objects, strings, unknown objects
 */
function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }

  return 'Unknown error';
}

/**
 * Pattern matchers for common error types.
 * Each function encapsulates error classification logic.
 */

function isNetworkError(message: string): boolean {
  const networkPatterns = [
    'fetch failed',
    'network error',
    'failed to fetch',
    'network request failed',
    'connection refused',
    'ECONNREFUSED',
  ];

  const lowerMessage = message.toLowerCase();
  return networkPatterns.some((pattern) =>
    lowerMessage.includes(pattern.toLowerCase())
  );
}

function isTimeoutError(message: string): boolean {
  const timeoutPatterns = ['timeout', 'timed out', 'request timeout'];

  const lowerMessage = message.toLowerCase();
  return timeoutPatterns.some((pattern) =>
    lowerMessage.includes(pattern.toLowerCase())
  );
}

function isRoomNotFoundError(message: string): boolean {
  return message.toLowerCase().includes('room not found');
}

function isGameAlreadyStartedError(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  return (
    lowerMessage.includes('not in lobby status') ||
    lowerMessage.includes('already started')
  );
}

function isRateLimitError(message: string): boolean {
  const rateLimitPatterns = ['rate limit', 'too many requests', 'rate limited'];

  const lowerMessage = message.toLowerCase();
  return rateLimitPatterns.some((pattern) =>
    lowerMessage.includes(pattern.toLowerCase())
  );
}
