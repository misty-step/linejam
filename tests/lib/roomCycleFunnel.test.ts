import { describe, expect, it } from 'vitest';
import { buildRoomCycleFunnelReport } from '@/lib/analytics/roomCycleFunnel';

const window = { from: 1_000, to: 10_000 };

describe('buildRoomCycleFunnelReport', () => {
  it('counts one human room across retries, rematches, AI seats, and abandonment', () => {
    const report = buildRoomCycleFunnelReport({
      ...window,
      rooms: [
        {
          roomIdHash: 'private-room-key',
          createdAt: 2_000,
          joins: [
            { joinedAt: 2_001, playerKind: 'human', participantKey: 'human-a' },
            { joinedAt: 2_002, playerKind: 'human', participantKey: 'human-b' },
            { joinedAt: 2_003, playerKind: 'AI' },
            { joinedAt: 2_004, playerKind: 'AI' },
          ],
          cycles: [
            {
              cycle: 1,
              startedAt: 3_000,
              writingCompletedAt: 8_000,
              allRevealedAt: 8_500,
              completionKind: 'normal',
            },
            { cycle: 2, startedAt: 9_000, completionKind: 'abandoned' },
          ],
        },
        {
          roomIdHash: 'one-human-room',
          createdAt: 2_500,
          joins: [
            {
              joinedAt: 2_501,
              playerKind: 'human',
              participantKey: 'one-human',
            },
            { joinedAt: 2_502, playerKind: 'AI' },
          ],
          cycles: [{ cycle: 1, startedAt: 3_500 }],
        },
      ],
      events: [
        {
          event: 'artifact_action',
          occurredAt: 8_600,
          roomIdHash: 'private-room-key',
          cycle: 1,
          playerKind: 'human',
          action: 'save',
        },
        {
          event: 'artifact_action',
          occurredAt: 8_600,
          roomIdHash: 'private-room-key',
          cycle: 1,
          playerKind: 'human',
          action: 'save',
        },
      ],
    });

    expect(report.cohort).toEqual({
      uniqueHumanRooms: 1,
      source: 'server-derived',
    });
    expect(report.metrics.gameStarted).toEqual({
      count: 1,
      rate: 1,
      source: 'server-derived',
    });
    expect(report.metrics.writingCompleted.count).toBe(1);
    expect(report.metrics.allRevealed.count).toBe(1);
    expect(report.metrics.encore.count).toBe(1);
    expect(report.metrics.artifactAction).toEqual({
      count: 1,
      rate: 1,
      source: 'event-derived',
    });
    expect(report.timeToStartSeconds).toMatchObject({
      count: 1,
      median: 1,
      p90: 1,
      source: 'server-derived',
    });
  });

  it('returns only aggregate counts and never leaks room or content fields', () => {
    const report = buildRoomCycleFunnelReport({
      ...window,
      rooms: [
        {
          roomIdHash: 'room-secret',
          createdAt: 2_000,
          joins: [
            { joinedAt: 2_001, playerKind: 'human', participantKey: 'human-a' },
            { joinedAt: 2_002, playerKind: 'human', participantKey: 'human-b' },
          ],
          cycles: [{ cycle: 1 }],
        },
      ],
      events: [],
    });

    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain('room-secret');
    expect(serialized).not.toContain('guest-token');
    expect(serialized).not.toContain('ABCD');
    expect(Object.keys(report)).toEqual([
      'window',
      'cohort',
      'metrics',
      'timeToStartSeconds',
    ]);
  });

  it('rejects an unbounded or reversed window', () => {
    expect(() =>
      buildRoomCycleFunnelReport({ from: 0, to: 0, rooms: [], events: [] })
    ).toThrow('Funnel window end must be after its start');
    expect(() =>
      buildRoomCycleFunnelReport({
        from: Number.NaN,
        to: 1,
        rooms: [],
        events: [],
      })
    ).toThrow('Funnel window bounds must be finite timestamps');
  });

  it('deduplicates retried room projections by participant and cycle', () => {
    const room = {
      roomIdHash: '0123456789abcdef',
      createdAt: 2_000,
      joins: [
        { joinedAt: 2_001, playerKind: 'human' as const, participantKey: 'a' },
        { joinedAt: 2_002, playerKind: 'human' as const, participantKey: 'b' },
        { joinedAt: 2_003, playerKind: 'human' as const, participantKey: 'a' },
        { joinedAt: 2_004, playerKind: 'AI' as const, participantKey: 'bot' },
      ],
      cycles: [{ cycle: 1, startedAt: 3_000 }],
    };
    const report = buildRoomCycleFunnelReport({
      ...window,
      rooms: [
        room,
        { ...room, joins: [...room.joins], cycles: [...room.cycles] },
      ],
      events: [],
    });
    expect(report.cohort.uniqueHumanRooms).toBe(1);
    expect(report.metrics.gameStarted.count).toBe(1);
  });

  it('keeps abandoned first cycles out of completion while counting a started encore', () => {
    const report = buildRoomCycleFunnelReport({
      ...window,
      rooms: [
        {
          roomIdHash: 'fedcba9876543210',
          createdAt: 2_000,
          joins: [
            { joinedAt: 2_001, playerKind: 'human', participantKey: 'a' },
            { joinedAt: 2_002, playerKind: 'human', participantKey: 'b' },
          ],
          cycles: [
            { cycle: 1, startedAt: 3_000, completionKind: 'abandoned' },
            {
              cycle: 2,
              startedAt: 4_000,
              writingCompletedAt: 5_000,
              allRevealedAt: 6_000,
              completionKind: 'normal',
            },
          ],
        },
      ],
      events: [],
    });
    expect(report.metrics.gameStarted.count).toBe(1);
    expect(report.metrics.writingCompleted.count).toBe(0);
    expect(report.metrics.allRevealed.count).toBe(0);
    expect(report.metrics.encore.count).toBe(1);
  });

  it('ignores malformed, AI, unknown-cycle, and out-of-window artifact events', () => {
    const report = buildRoomCycleFunnelReport({
      ...window,
      rooms: [
        {
          roomIdHash: '0011223344556677',
          createdAt: 2_000,
          joins: [
            { joinedAt: 2_001, playerKind: 'human', participantKey: 'a' },
            { joinedAt: 2_002, playerKind: 'human', participantKey: 'b' },
          ],
          cycles: [{ cycle: 1, startedAt: 3_000 }],
        },
      ],
      events: [
        {
          event: 'artifact_action',
          occurredAt: 2_500,
          roomIdHash: '0011223344556677',
          cycle: 1,
          playerKind: 'AI',
          action: 'save',
        },
        {
          event: 'artifact_action',
          occurredAt: 2_501,
          roomIdHash: '0011223344556677',
          cycle: 99,
          playerKind: 'human',
          action: 'save',
        },
        {
          event: 'artifact_action',
          occurredAt: 2_502,
          roomIdHash: '0011223344556677',
          cycle: 1,
          playerKind: 'human',
          action: 'delete' as 'save',
        },
        {
          event: 'artifact_action',
          occurredAt: 10_000,
          roomIdHash: '0011223344556677',
          cycle: 1,
          playerKind: 'human',
          action: 'save',
        },
      ],
    });
    expect(report.metrics.artifactAction.count).toBe(0);
  });
});
