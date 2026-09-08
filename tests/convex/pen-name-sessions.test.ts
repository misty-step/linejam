import { describe, expect, it } from 'vitest';
import { api } from '../../convex/_generated/api';
import { WORD_COUNTS } from '../../convex/lib/gameRules';
import { signGuestToken } from '../../lib/guestToken';
import { setupConvexTest } from '../helpers/convexTest';

async function playEveryRound(
  t: ReturnType<typeof setupConvexTest>,
  code: string,
  guestTokens: string[]
) {
  for (const count of WORD_COUNTS) {
    await Promise.all(
      guestTokens.map(async (guestToken) => {
        const assignment = await t.query(api.game.getCurrentAssignment, {
          roomCode: code,
          guestToken,
        });
        if (!assignment)
          throw new Error('Expected an active writing assignment');
        await t.mutation(api.game.submitLine, {
          poemId: assignment.poemId,
          lineIndex: assignment.lineIndex,
          text: Array.from({ length: count }, () => 'word').join(' '),
          guestToken,
        });
      })
    );
  }
}

describe('pen names across guest sessions', () => {
  it('attributes a new game to the current room name rather than the first guest name', async () => {
    const t = setupConvexTest();
    const [hostToken, bobToken] = await Promise.all([
      signGuestToken('returning-host'),
      signGuestToken('returning-bob'),
    ]);
    await t.mutation(api.rooms.createRoom, {
      displayName: 'Alejandro',
      guestToken: hostToken,
    });
    const { code } = await t.mutation(api.rooms.createRoom, {
      displayName: ' \tBilly\n ',
      guestToken: hostToken,
    });
    await t.mutation(api.rooms.joinRoom, {
      code,
      displayName: 'Bob',
      guestToken: bobToken,
    });
    await t.mutation(api.game.startGame, { code, guestToken: hostToken });

    await playEveryRound(t, code, [hostToken, bobToken]);

    const reveal = await t.query(api.game.getRevealPhaseState, {
      roomCode: code,
      guestToken: hostToken,
    });
    const authors = new Set(
      reveal?.myPoems.flatMap((poem) =>
        poem.lines.map((line) => line.authorName)
      )
    );
    expect(authors).toEqual(new Set(['Billy', 'Bob']));
  });

  it('keeps old signatures when rejoining and ignores names selected in another room', async () => {
    const t = setupConvexTest();
    const [hostToken, bobToken] = await Promise.all([
      signGuestToken('renaming-host'),
      signGuestToken('renaming-bob'),
    ]);
    const { code } = await t.mutation(api.rooms.createRoom, {
      displayName: 'Alejandro',
      guestToken: hostToken,
    });
    await t.mutation(api.rooms.joinRoom, {
      code,
      displayName: 'Bob',
      guestToken: bobToken,
    });
    await t.mutation(api.game.startGame, { code, guestToken: hostToken });

    const opening = await t.query(api.game.getCurrentAssignment, {
      roomCode: code,
      guestToken: hostToken,
    });
    const bobOpening = await t.query(api.game.getCurrentAssignment, {
      roomCode: code,
      guestToken: bobToken,
    });
    if (!opening || !bobOpening)
      throw new Error('Expected opening assignments');
    await t.mutation(api.game.submitLine, {
      poemId: opening.poemId,
      lineIndex: opening.lineIndex,
      text: 'opening',
      guestToken: hostToken,
    });
    await t.mutation(api.game.submitLine, {
      poemId: bobOpening.poemId,
      lineIndex: bobOpening.lineIndex,
      text: 'friend',
      guestToken: bobToken,
    });

    await t.mutation(api.rooms.joinRoom, {
      code,
      displayName: ' \tBilly\n ',
      guestToken: hostToken,
    });
    const otherRoom = await t.mutation(api.rooms.createRoom, {
      displayName: 'Notebook',
      guestToken: hostToken,
    });
    // Rejoining elsewhere changes the profile, but not this room's pen name.
    await t.mutation(api.rooms.joinRoom, {
      code: otherRoom.code,
      displayName: 'Celeste',
      guestToken: hostToken,
    });

    await expect(
      t.mutation(api.game.submitLine, {
        poemId: opening.poemId,
        lineIndex: opening.lineIndex,
        text: 'different draft',
        guestToken: hostToken,
      })
    ).resolves.toEqual({ status: 'already_submitted', text: 'opening' });

    const next = await t.query(api.game.getCurrentAssignment, {
      roomCode: code,
      guestToken: hostToken,
    });
    if (!next) throw new Error('Expected the second-round assignment');
    await t.mutation(api.game.submitLine, {
      poemId: next.poemId,
      lineIndex: next.lineIndex,
      text: 'new words',
      guestToken: hostToken,
    });

    const [oldLine, newLine] = await t.run(async (ctx) =>
      Promise.all(
        [opening, next].map((assignment) =>
          ctx.db
            .query('lines')
            .withIndex('by_poem_index', (q) =>
              q
                .eq('poemId', assignment.poemId)
                .eq('indexInPoem', assignment.lineIndex)
            )
            .unique()
        )
      )
    );
    expect(oldLine).toMatchObject({
      text: 'opening',
      authorDisplayName: 'Alejandro',
    });
    expect(newLine).toMatchObject({
      text: 'new words',
      authorDisplayName: 'Billy',
    });
  });

  it('names archive collaborators as they signed each poem', async () => {
    const t = setupConvexTest();
    const [hostToken, bobToken] = await Promise.all([
      signGuestToken('archive-host'),
      signGuestToken('archive-bob'),
    ]);
    const { code } = await t.mutation(api.rooms.createRoom, {
      displayName: 'Billy',
      guestToken: hostToken,
    });
    await t.mutation(api.rooms.joinRoom, {
      code,
      displayName: 'Bob',
      guestToken: bobToken,
    });
    await t.mutation(api.game.startGame, { code, guestToken: hostToken });
    await playEveryRound(t, code, [hostToken, bobToken]);

    // Bob plays elsewhere as Robert; the saved poems keep the byline he used.
    const later = await t.mutation(api.rooms.createRoom, {
      displayName: 'Billy',
      guestToken: hostToken,
    });
    await t.mutation(api.rooms.joinRoom, {
      code: later.code,
      displayName: 'Robert',
      guestToken: bobToken,
    });

    const archive = await t.query(api.archive.getArchiveData, {
      guestToken: hostToken,
    });
    const names = new Set(
      archive.poems.flatMap((poem) => [
        ...poem.coAuthors,
        ...poem.lines.map((line) => line.authorName),
      ])
    );
    expect(names).toEqual(new Set(['Billy', 'Bob']));
  });
});
