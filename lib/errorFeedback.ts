import { ConvexError } from 'convex/values';
import type { ErrorReportable } from '@/lib/errorCore';
import { RATE_LIMIT_EXCEEDED_MESSAGE } from '@/lib/rateLimit';

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
export type FeedbackError = ErrorReportable;

/**
 * Return true only for an expected Convex rate-limit rejection.
 *
 * Convex production clients receive the actionable message in `data` while
 * `message` is redacted. Requiring a genuine ConvexError instance and the
 * exact canonical payload prevents generic failures that merely mention rate
 * limits from being hidden from observability.
 */
export function isExpectedConvexRateLimitError(
  error: ErrorReportable
): boolean {
  return (
    error instanceof ConvexError && error.data === RATE_LIMIT_EXCEEDED_MESSAGE
  );
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
 * @param error - Parsed error from a caught value
 * @returns Structured feedback ready for UI display
 *
 * @example
 * ```typescript
 * try {
 *   await createRoomMutation();
 * } catch (cause) {
 *   const error = toErrorReportable(cause);
 *   const feedback = errorToFeedback(error);
 *   setError(feedback.message);
 * }
 * ```
 */
export function errorToFeedback(error: FeedbackError): ErrorFeedback {
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

  if (isRoomFullError(message)) {
    return {
      message:
        'This room is full (8 players max). Ask the host to start a new room.',
      variant: 'error',
    };
  }

  if (isRoomClosedError(message)) {
    return {
      message: 'This room has been closed. Ask the host for a new room code.',
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
function extractErrorMessage(error: FeedbackError): string {
  if (error === null || error === undefined) {
    return 'Unknown error';
  }

  if (error instanceof Object && 'data' in error && error.data != null) {
    return String(error.data);
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (error instanceof Object && 'message' in error && error.message != null) {
    return String(error.message);
  }

  const stringified = String(error);
  if (stringified !== '[object Object]') {
    return stringified;
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
    lowerMessage.includes('already started') ||
    lowerMessage.includes('game in progress') ||
    // Live server message since linejam-974: joinRoom only rejects a game
    // state when late join is not allowed (e.g. the game just completed).
    lowerMessage.includes('cannot join this game state')
  );
}

function isRoomFullError(message: string): boolean {
  return message.toLowerCase().includes('room is full');
}

function isRoomClosedError(message: string): boolean {
  return message.toLowerCase().includes('room is closed');
}

function isRateLimitError(message: string): boolean {
  const rateLimitPatterns = ['rate limit', 'too many requests', 'rate limited'];

  const lowerMessage = message.toLowerCase();
  return rateLimitPatterns.some((pattern) =>
    lowerMessage.includes(pattern.toLowerCase())
  );
}
