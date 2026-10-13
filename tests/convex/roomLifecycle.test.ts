import { describe, expect, it } from 'vitest';
import { api } from '../../convex/_generated/api';
import { setupConvexTest } from '../helpers/convexTest';
import { asUser, seedClerkUser } from '../helpers/convexSeed';
import { WORD_COUNTS } from '../../convex/lib/gameRules';

describe('room lifecycle', () => {
  it('shares selected avatars with another participant through rejoin, reading, and rematch', async () => {
    const t = setupConvexTest();
    const hostId = await seedClerkUser(t, 'avatar-host');
    const friendId = await seedClerkUser(t, 'avatar-friend');
    const host = asUser(t, 'avatar-host');
    const friend = asUser(t, 'avatar-friend');

    const { code } = await host.mutation(api.rooms.createRoom, {
      displayName: 'Host',
      avatarId: 'rhyme',
    });
    await friend.mutation(api.rooms.joinRoom, {
      code,
      displayName: 'Friend',
      avatarId: 'quill',
    });

    const friendView = await friend.query(api.rooms.getRoomState, { code });
    expect(
      friendView?.players.find((player) => player.userId === hostId)?.avatarId
    ).toBe('rhyme');

    // An older transport or a reconnect must not replace the room selection.
    await friend.mutation(api.rooms.joinRoom, {
      code,
      displayName: 'Friend',
    });
    const rejoined = await host.query(api.rooms.getRoomState, { code });
    expect(
      rejoined?.players.find((player) => player.userId === friendId)?.avatarId
    ).toBe('quill');

    // A deliberate new choice does replace it, without creating a new member.
    await friend.mutation(api.rooms.joinRoom, {
      code,
      displayName: 'Friend',
      avatarId: 'haiku',
    });
    await host.mutation(api.game.startGame, { code });
    const progress = await host.query(api.game.getRoundProgress, {
      roomCode: code,
    });
    expect(progress?.players).toHaveLength(2);
    expect(
      progress?.players.find((player) => player.userId === friendId)?.avatarId
    ).toBe('haiku');

    // The waiting moment reads your own character before the roster loads.
    const friendAssignment = await friend.query(api.game.getCurrentAssignment, {
      roomCode: code,
    });
    expect(friendAssignment?.viewer).toMatchObject({
      displayName: 'Friend',
      avatarId: 'haiku',
    });

    for (let round = 0; round < WORD_COUNTS.length; round++) {
      for (const participant of [host, friend]) {
        const assignment = await participant.query(
          api.game.getCurrentAssignment,
          { roomCode: code }
        );
        if (!assignment) throw new Error('Expected an active assignment');
        await participant.mutation(api.game.submitLine, {
          poemId: assignment.poemId,
          lineIndex: assignment.lineIndex,
          text: Array(WORD_COUNTS[round]).fill('word').join(' '),
        });
      }
    }

    const reading = await host.query(api.game.getRevealPhaseState, {
      roomCode: code,
    });
    expect(
      reading?.poems.find((poem) => poem.assignedReaderId === friendId)
        ?.readerAvatarId
    ).toBe('haiku');

    await friend.mutation(api.game.startNewCycle, { roomCode: code });
    await friend.mutation(api.game.startGame, { code });
    const rematch = await host.query(api.game.getRoundProgress, {
      roomCode: code,
    });
    expect(
      rematch?.players.find((player) => player.userId === friendId)?.avatarId
    ).toBe('haiku');
    const rematchFriendView = await friend.query(api.rooms.getRoomState, {
      code,
    });
    expect(
      rematchFriendView?.players.find((player) => player.userId === hostId)
        ?.avatarId
    ).toBe('rhyme');
  });
});
