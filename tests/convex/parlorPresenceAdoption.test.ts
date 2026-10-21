import { describe, expect, it, vi } from 'vitest';
import { api } from '../../convex/_generated/api';
import { WORD_COUNTS } from '../../convex/lib/gameRules';
import { setupConvexTest } from '../helpers/convexTest';
import { asUser, seedClerkUser } from '../helpers/convexSeed';

describe('released Parlor core adoption', () => {
  it('preserves three eligible writers through delayed presence, rematch and closure', async () => {
    const joinedAt = 2_000_000_000_000;
    const clock = vi.spyOn(Date, 'now').mockReturnValue(joinedAt);
    try {
      const t = setupConvexTest();
      const names = ['Ari', 'Bea', 'Cy'];
      for (const name of names) await seedClerkUser(t, name);
      const { code, roomId } = await asUser(t, 'Ari').mutation(
        api.rooms.createRoom,
        { displayName: 'Ari' }
      );
      for (const name of ['Bea', 'Cy']) {
        await asUser(t, name).mutation(api.rooms.joinRoom, {
          code,
          displayName: name,
        });
      }
      for (const cycle of [1, 2]) {
        const beatAt = joinedAt + (cycle - 1) * 60_000;
        clock.mockReturnValue(beatAt);
        for (const name of names) {
          await asUser(t, name).mutation(api.presence.heartbeat, {
            roomCode: code,
          });
        }
        clock.mockReturnValue(beatAt + 18_000);
        await asUser(t, cycle === 1 ? 'Ari' : 'Bea').mutation(
          api.game.startGame,
          { code }
        );
        const match = await t.run(async (ctx) => {
          const rows = await ctx.db
            .query('matches')
            .withIndex('by_room_cycle', (q) =>
              q.eq('roomId', roomId).eq('cycle', cycle)
            )
            .collect();
          expect(rows).toHaveLength(1);
          const selected = rows[0];
          if (!selected) throw new Error('Match missing');
          const roster = await ctx.db
            .query('matchParticipants')
            .withIndex('by_match_seat', (q) => q.eq('matchId', selected._id))
            .collect();
          expect(roster.map((member) => member.seatIndex)).toEqual([0, 1, 2]);
          return selected;
        });
        for (const wordCount of WORD_COUNTS) {
          for (const name of names) {
            const assignment = await asUser(t, name).query(
              api.game.getCurrentAssignment,
              { roomCode: code }
            );
            if (!assignment) throw new Error('Writer assignment missing');
            await asUser(t, name).mutation(api.game.submitLine, {
              lineIndex: assignment.lineIndex,
              poemId: assignment.poemId,
              text: Array.from({ length: wordCount }, () => 'fixture').join(
                ' '
              ),
            });
          }
        }
        expect((await t.run((ctx) => ctx.db.get(match._id)))?.status).toBe(
          'completed'
        );
        await asUser(t, 'Cy').mutation(api.game.startNewCycle, {
          roomCode: code,
        });
      }
      await asUser(t, 'Ari').mutation(api.rooms.closeRoom, { roomCode: code });
      await seedClerkUser(t, 'New arrival');
      await expect(
        asUser(t, 'New arrival').mutation(api.rooms.joinRoom, {
          code,
          displayName: 'New arrival',
        })
      ).resolves.toMatchObject({ ok: false, code: 'ROOM_NOT_OPEN' });
      const history = await t.run((ctx) =>
        ctx.db
          .query('matches')
          .withIndex('by_room_cycle', (q) => q.eq('roomId', roomId))
          .collect()
      );
      expect(history.map((match) => match.status)).toEqual([
        'completed',
        'completed',
      ]);
    } finally {
      clock.mockRestore();
    }
  });
});
