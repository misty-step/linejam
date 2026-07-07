import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockTrack = vi.fn();

vi.mock('@vercel/analytics', () => ({
  track: (...args: unknown[]) => mockTrack(...args),
}));

import {
  trackAiPlayerAdded,
  trackGameCompleted,
  trackGameCreated,
  trackGameJoined,
  trackGameStarted,
  trackPoemImageSaved,
  trackPoemShared,
  trackRecapExported,
  trackRoomInviteShared,
} from '@/lib/analytics';

describe('analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses an empty payload when game creation props are omitted', () => {
    trackGameCreated();

    expect(mockTrack).toHaveBeenCalledWith('game_created', {});
  });

  it('forwards the remaining analytics events with their payloads', () => {
    trackGameCreated({ playerCount: 4 });
    trackGameJoined({ roomCode: 'ABCD' });
    trackGameStarted({ playerCount: 4, hasAi: true });
    trackGameCompleted({ playerCount: 4, poemCount: 2, hasAi: true });
    trackPoemShared({ method: 'clipboard' });
    trackRoomInviteShared({ method: 'native-share', roomCode: 'WXYZ' });
    trackAiPlayerAdded({ playerCount: 5 });
    trackPoemImageSaved({ method: 'native-share' });
    trackRecapExported({ method: 'print', poemCount: 6 });

    expect(mockTrack.mock.calls).toEqual([
      ['game_created', { playerCount: 4 }],
      ['game_joined', { roomCode: 'ABCD' }],
      ['game_started', { playerCount: 4, hasAi: true }],
      ['game_completed', { playerCount: 4, poemCount: 2, hasAi: true }],
      ['poem_shared', { method: 'clipboard' }],
      ['room_invite_shared', { method: 'native-share', roomCode: 'WXYZ' }],
      ['ai_player_added', { playerCount: 5 }],
      ['poem_image_saved', { method: 'native-share' }],
      ['recap_exported', { method: 'print', poemCount: 6 }],
    ]);
  });
});
