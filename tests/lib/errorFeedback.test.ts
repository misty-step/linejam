import { describe, expect, it } from 'vitest';
import { ConvexError } from 'convex/values';
import { errorToFeedback } from '@/lib/errorFeedback';

describe('errorToFeedback', () => {
  describe('network errors', () => {
    it('transforms fetch failures to user-friendly message', () => {
      const error = new Error('fetch failed');
      const feedback = errorToFeedback(error);

      expect(feedback.message).toBe(
        'Unable to connect. Please check your internet connection and try again.'
      );
      expect(feedback.variant).toBe('error');
    });

    it('transforms network timeouts to user-friendly message', () => {
      const error = new Error('Request timeout');
      const feedback = errorToFeedback(error);

      expect(feedback.message).toContain('taking longer than expected');
      expect(feedback.variant).toBe('error');
    });
  });

  describe('Convex errors', () => {
    it('transforms validation errors to specific guidance', () => {
      const error = new Error('Cannot join a room that is not in LOBBY status');
      const feedback = errorToFeedback(error);

      expect(feedback.message).toBe(
        'This game has already started. Please wait for the next session or ask the host to create a new room.'
      );
      expect(feedback.variant).toBe('error');
    });

    it('transforms room not found errors', () => {
      const error = new Error('Room not found');
      const feedback = errorToFeedback(error);

      expect(feedback.message).toBe(
        'Room code not found. Please check the code and try again.'
      );
      expect(feedback.variant).toBe('error');
    });

    it('transforms rate limit errors', () => {
      const error = new Error('Rate limit exceeded');
      const feedback = errorToFeedback(error);

      expect(feedback.message).toContain('Too many attempts');
      expect(feedback.message).toContain('wait');
      expect(feedback.variant).toBe('error');
    });
  });

  describe('ConvexError data extraction (survives production redaction)', () => {
    it('classifies from ConvexError.data, the only field that survives prod', () => {
      // In production Convex redacts Error.message to "Server Error" — only
      // ConvexError.data reaches the client. Simulate that exact shape.
      const error = new ConvexError('Room not found');
      error.message = '[Request ID: abc123] Server Error';

      const feedback = errorToFeedback(error);

      expect(feedback.message).toBe(
        'Room code not found. Please check the code and try again.'
      );
    });

    it('classifies duck-typed ConvexError shapes with string data', () => {
      const error = { message: 'Server Error', data: 'Room is full' };
      const feedback = errorToFeedback(error);

      expect(feedback.message).toContain('room is full');
    });
  });

  describe('party-path error taxonomy', () => {
    it('maps game-in-progress joins to the already-started message', () => {
      const error = new ConvexError(
        'Cannot join a room with a game in progress'
      );
      const feedback = errorToFeedback(error);

      expect(feedback.message).toBe(
        'This game has already started. Please wait for the next session or ask the host to create a new room.'
      );
      expect(feedback.variant).toBe('error');
    });

    it('maps room-full errors to a distinct message', () => {
      const error = new ConvexError('Room is full');
      const feedback = errorToFeedback(error);

      expect(feedback.message).toBe(
        'This room is full (8 players max). Ask the host to start a new room.'
      );
      expect(feedback.variant).toBe('error');
    });

    it('maps room-closed errors to a distinct message', () => {
      const error = new ConvexError('Room is closed');
      const feedback = errorToFeedback(error);

      expect(feedback.message).toBe(
        'This room has been closed. Ask the host for a new room code.'
      );
      expect(feedback.variant).toBe('error');
    });
  });

  describe('generic errors', () => {
    it('provides helpful fallback for unknown errors', () => {
      const error = new Error('Something went wrong');
      const feedback = errorToFeedback(error);

      expect(feedback.message).toContain('unexpected error');
      expect(feedback.message).toContain('try again');
      expect(feedback.variant).toBe('error');
    });

    it('handles non-Error objects gracefully', () => {
      const error = { message: 'Unknown error' };
      const feedback = errorToFeedback(error);

      expect(feedback.message).toBeTruthy();
      expect(feedback.variant).toBe('error');
    });

    it('handles string errors', () => {
      const error = 'Something failed';
      const feedback = errorToFeedback(error);

      expect(feedback.message).toBeTruthy();
      expect(feedback.variant).toBe('error');
    });
  });

  describe('interface simplicity', () => {
    it('returns only message and variant (no YAGNI fields)', () => {
      const error = new Error('test error');
      const feedback = errorToFeedback(error);

      expect(feedback).toHaveProperty('message');
      expect(feedback).toHaveProperty('variant');
      expect(Object.keys(feedback)).toHaveLength(2);
    });
  });
});
