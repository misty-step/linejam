import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  markPostHogReady,
  resetPostHogReady,
} from '@/lib/posthog/posthogReady';
import {
  hashRoomId,
  resetCapturedAnalyticsForTests,
  setPostHogClientForTests,
  trackArtifactAction,
  trackGameCompleted,
  trackGameCreated,
  trackGameJoined,
  trackGameStarted,
  trackLineSubmitted,
  trackLobbyReady,
  trackPageview,
  trackPoemShared,
  trackPoemImageSaved,
  trackRecapExported,
  trackRoomInviteShared,
  type PostHogCaptureClient,
} from '@/lib/analytics';
const props = {
  roomIdHash: hashRoomId('room-internal-id'),
  cycle: 1,
};

describe('analytics', () => {
  const capturedCalls: Array<Parameters<PostHogCaptureClient['capture']>> = [];

  beforeEach(() => {
    vi.stubGlobal('window', { location: { pathname: '/host' } });
    capturedCalls.length = 0;
    resetCapturedAnalyticsForTests();
    setPostHogClientForTests({
      capture: (event, properties) => {
        capturedCalls.push([event, properties]);
      },
    });
    markPostHogReady();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    resetPostHogReady();
    resetCapturedAnalyticsForTests();
  });
  it('hashes room ids without returning the raw value', () => {
    expect(hashRoomId('room-internal-id')).toMatch(/^[0-9a-f]{16}$/);
    expect(hashRoomId('room-internal-id')).toBe(hashRoomId('room-internal-id'));
    expect(hashRoomId('room-internal-id')).not.toContain('room-internal-id');
  });

  it('emits one canonical event per room-cycle funnel stage', () => {
    trackGameCreated(props);
    trackGameJoined(props);
    trackLobbyReady(props);
    trackGameStarted(props);
    trackLineSubmitted({ ...props, round: 0 });
    trackGameCompleted({ ...props, round: 8 });
    trackArtifactAction({ ...props, action: 'save', round: 8 });

    expect(capturedCalls).toEqual([
      ['game_created', props],
      ['game_joined', props],
      ['lobby_ready', props],
      ['game_started', props],
      ['line_submitted', { ...props, round: 0 }],
      ['game_completed', { ...props, round: 8 }],
      ['artifact_action', { ...props, round: 8, action: 'save' }],
    ]);
    for (const [, properties] of capturedCalls) {
      expect(properties).not.toHaveProperty('playerKind');
    }
  });

  it('deduplicates retries by room, cycle, round, and action', () => {
    trackLineSubmitted({ ...props, round: 3 });
    trackLineSubmitted({ ...props, round: 3 });
    trackArtifactAction({ ...props, round: 8, action: 'save' });
    trackArtifactAction({ ...props, round: 8, action: 'save' });
    trackArtifactAction({ ...props, round: 8, action: 'share' });
    expect(capturedCalls).toHaveLength(3);
  });

  it('does not capture before SDK readiness', () => {
    resetPostHogReady();
    trackGameCreated(props);
    trackPageview();
    expect(capturedCalls).toHaveLength(0);
  });

  it('isolates SDK exceptions on every capture path and recovers on a later action', () => {
    setPostHogClientForTests({
      capture: () => {
        throw new Error('analytics unavailable');
      },
    });
    expect(() => {
      trackGameCreated(props);
      trackPageview();
      trackPoemShared({ method: 'clipboard' });
      trackPoemImageSaved({ method: 'download' });
      trackRecapExported({ method: 'print', poemCount: 2 });
      trackRoomInviteShared({ method: 'clipboard', roomCode: 'SECRET' });
    }).not.toThrow();
    setPostHogClientForTests({
      capture: (name, properties) => capturedCalls.push([name, properties]),
    });
    trackGameCreated(props);
    expect(capturedCalls).toEqual([['game_created', props]]);
  });

  it('never passes room codes into the SDK', () => {
    trackRoomInviteShared({ method: 'clipboard', roomCode: 'PRIVATE_CANARY' });
    expect(capturedCalls).toEqual([
      ['room_invite_shared', { method: 'clipboard' }],
    ]);
  });

  it('counts initialization and delayed route effects as one pageview per visit', () => {
    trackPageview();
    trackPageview();
    window.location.pathname = '/room/ABCD';
    trackPageview();
    trackPageview();
    window.location.pathname = '/host';
    trackPageview();
    expect(capturedCalls).toEqual([
      ['$pageview', undefined],
      ['$pageview', undefined],
      ['$pageview', undefined],
    ]);
  });
});
