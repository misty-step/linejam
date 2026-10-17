// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CaptureResult } from 'posthog-js';
import {
  resetCapturedAnalyticsForTests,
  setPostHogClientForTests,
  trackJoinAttempted,
  trackJoinFailed,
  trackGameStarted,
  trackLineSubmitted,
} from '@/lib/analytics';
import {
  markPostHogReady,
  resetPostHogReady,
} from '@/lib/posthog/posthogReady';
import { sanitizeAnalyticsEvent } from '@/lib/posthog/config';

const id = '019919ab-0000-7000-8000-000000000001';
const canary = 'PRIVATE_CANARY_token_name_poem';
const scope = { roomIdHash: '0123456789abcdef', cycle: 2 };

describe('party funnel transport', () => {
  const captured: CaptureResult[] = [];
  beforeEach(() => {
    captured.length = 0;
    window.history.replaceState({}, '', `/join?code=${canary}`);
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_ENVIRONMENT', 'production');
    resetCapturedAnalyticsForTests();
    markPostHogReady();
    setPostHogClientForTests({
      capture: (event, properties) => {
        const result = sanitizeAnalyticsEvent({
          uuid: id,
          event,
          properties: { distinct_id: id, ...properties },
        });
        if (result) captured.push(result);
      },
    });
  });
  afterEach(() => {
    resetPostHogReady();
    resetCapturedAnalyticsForTests();
    vi.unstubAllEnvs();
  });

  it('keeps attempts distinct, bounds rejection reasons, and measures confirmed writer outcomes once', () => {
    trackJoinAttempted();
    trackJoinFailed('ROOM_FULL');
    trackJoinAttempted();
    trackJoinFailed(canary);
    trackGameStarted({ ...scope, playerCount: 8 });
    trackGameStarted({ ...scope, playerCount: 8 });
    trackLineSubmitted({ ...scope, round: 0, timeToFirstLineMs: 12_345 });
    trackLineSubmitted({ ...scope, round: 0, timeToFirstLineMs: 23_456 });
    expect(captured.map((event) => event.event)).toEqual([
      'join_attempted',
      'join_failed',
      'join_attempted',
      'join_failed',
      'game_started',
      'line_submitted',
    ]);
    expect(captured[1].properties.failureCode).toBe('ROOM_FULL');
    expect(captured[3].properties.failureCode).toBe('REQUEST_FAILED');
    expect(captured[4].properties.playerCount).toBe(8);
    expect(captured[5].properties.timeToFirstLineMs).toBe(12_345);
    expect(JSON.stringify(captured)).not.toContain(canary);
  });

  it.each([-1, Infinity, 0.5, 7 * 86400_000 + 1, canary])(
    'drops invalid elapsed measurement %s',
    (timeToFirstLineMs) => {
      const result = sanitizeAnalyticsEvent({
        uuid: id,
        event: 'line_submitted',
        properties: { distinct_id: id, timeToFirstLineMs },
      });
      expect(result?.properties).not.toHaveProperty('timeToFirstLineMs');
    }
  );

  it.each([0, 1, 9, NaN, canary])(
    'drops invalid writer count %s',
    (playerCount) => {
      const result = sanitizeAnalyticsEvent({
        uuid: id,
        event: 'game_started',
        properties: { distinct_id: id, playerCount },
      });
      expect(result?.properties).not.toHaveProperty('playerCount');
    }
  );

  it('keeps admission and game outcomes nonblocking during sink failure and captures a later recovery', () => {
    setPostHogClientForTests({
      capture: () => {
        throw new Error('sink unavailable');
      },
    });
    expect(() => {
      trackJoinAttempted();
      trackJoinFailed(canary);
      trackGameStarted({ ...scope, playerCount: 8 });
    }).not.toThrow();
    setPostHogClientForTests({
      capture: (event) => captured.push({ uuid: id, event, properties: {} }),
    });
    trackJoinAttempted();
    trackGameStarted({ ...scope, playerCount: 8 });
    expect(captured.map((event) => event.event)).toEqual([
      'join_attempted',
      'game_started',
    ]);
  });
});
