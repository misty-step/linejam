import { describe, expect, it } from 'vitest';
import {
  RETENTION_BATCH_LIMITS,
  RETENTION_DURATIONS_MS,
  RETENTION_INVOCATION_LIMITS,
  RETENTION_POLICY_VERSION,
  retentionEligibleAt,
} from '../../../convex/lib/retentionPolicy';

describe('retention policy', () => {
  it('is versioned and gives every lifecycle class an explicit lifetime', () => {
    expect(RETENTION_POLICY_VERSION).toMatch(/^linejam-retention-v\d+$/);
    expect(RETENTION_DURATIONS_MS).toEqual({
      privateCompleted: 90 * 24 * 60 * 60 * 1000,
      abandoned: 7 * 24 * 60 * 60 * 1000,
      protectionRemoved: 30 * 24 * 60 * 60 * 1000,
      guestIdentity: 180 * 24 * 60 * 60 * 1000,
      guestReferenceDeferral: 30 * 24 * 60 * 60 * 1000,
      aiBookkeeping: 7 * 24 * 60 * 60 * 1000,
      operationalMetrics: 90 * 24 * 60 * 60 * 1000,
    });
  });

  it('derives deterministic eligibility timestamps', () => {
    expect(retentionEligibleAt(1_000, 'privateCompleted')).toBe(
      1_000 + RETENTION_DURATIONS_MS.privateCompleted
    );
    expect(retentionEligibleAt(1_000, 'abandoned')).toBe(
      1_000 + RETENTION_DURATIONS_MS.abandoned
    );
    expect(retentionEligibleAt(1_000, 'protectionRemoved')).toBe(
      1_000 + RETENTION_DURATIONS_MS.protectionRemoved
    );
  });

  it('declares a measured per-invocation ceiling below Convex mutation limits', () => {
    expect(
      Object.values(RETENTION_BATCH_LIMITS).every((limit) => limit > 0)
    ).toBe(true);
    expect(RETENTION_INVOCATION_LIMITS.maxCandidateRows).toBeLessThanOrEqual(
      512
    );
    expect(RETENTION_INVOCATION_LIMITS.maxDocumentReads).toBeLessThanOrEqual(
      1_024
    );
    expect(RETENTION_INVOCATION_LIMITS.maxDocumentWrites).toBeLessThanOrEqual(
      1_024
    );
  });
});
