import { describe, expect, it } from 'vitest';
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
