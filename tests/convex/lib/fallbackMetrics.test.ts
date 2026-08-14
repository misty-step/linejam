import { describe, expect, it } from 'vitest';
import {
  aiGenerationBucket,
  planAiFallbackCheckIn,
} from '../../../convex/lib/ai/fallbackMetrics';

describe('AI fallback metric planning', () => {
  it('uses one bounded UTC-hour bucket', () => {
    expect(aiGenerationBucket(Date.UTC(2026, 6, 15, 19, 42, 30))).toBe(
      Date.UTC(2026, 6, 15, 19)
    );
  });

  it('pages when the fallback rate exceeds the configured threshold', () => {
    expect(
      planAiFallbackCheckIn({
        totalGenerations: 5,
        fallbackGenerations: 2,
        fallbackReason: 'provider_error',
        thresholdPercent: 20,
        minimumGenerations: 5,
      })
    ).toEqual({
      status: 'error',
      summary: 'AI fallback rate is 40.0% (2/5) in the current hour.',
      context: {
        totalGenerations: 5,
        fallbackGenerations: 2,
        fallbackRatePercent: 40,
        fallbackReason: 'provider_error',
        thresholdPercent: 20,
      },
    });
  });

  it('stays healthy below threshold without leaking content or identity', () => {
    const plan = planAiFallbackCheckIn({
      totalGenerations: 10,
      fallbackGenerations: 2,
      fallbackReason: null,
      thresholdPercent: 20,
      minimumGenerations: 5,
    });

    expect(plan.status).toBe('ok');
    expect(plan.context).toEqual({
      totalGenerations: 10,
      fallbackGenerations: 2,
      fallbackRatePercent: 20,
      thresholdPercent: 20,
    });
    expect(Object.keys(plan.context)).not.toEqual(
      expect.arrayContaining(['poemId', 'roomId', 'guestId', 'text', 'userId'])
    );
  });

  it('records low-volume failures without paging before the sample floor', () => {
    expect(
      planAiFallbackCheckIn({
        totalGenerations: 4,
        fallbackGenerations: 4,
        fallbackReason: 'missing_configuration',
        thresholdPercent: 20,
        minimumGenerations: 5,
      }).status
    ).toBe('alive');
  });
});
