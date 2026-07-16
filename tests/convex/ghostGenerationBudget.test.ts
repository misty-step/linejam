import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

const env = vi.hoisted(() => {
  const original = { ...process.env };
  process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
  process.env.CANARY_API_KEY = 'test-canary-key';
  return { original };
});

import { internal } from '../../convex/_generated/api';
import type { Doc, Id } from '../../convex/_generated/dataModel';
import { WORD_COUNTS } from '../../convex/lib/gameRules';
import { getAiBudgetConfig } from '../../convex/lib/ai/budget';
import { setupConvexTest } from '../helpers/convexTest';

type T = ReturnType<typeof setupConvexTest>;

async function seedGame(
  t: T,
  players: Array<{
    name: string;
    kind?: 'human' | 'AI';
    aiPersonaId?: string;
  }>
) {
  return t.run(async (ctx) => {
    const createdAt = Date.now();
    const userIds: Id<'users'>[] = [];
    for (const player of players) {
      userIds.push(
        await ctx.db.insert('users', {
          displayName: player.name,
          kind: player.kind ?? 'human',
          ...(player.aiPersonaId ? { aiPersonaId: player.aiPersonaId } : {}),
          createdAt,
        })
      );
    }

    const roomId = await ctx.db.insert('rooms', {
      code: 'GBUD',
      hostUserId: userIds[0],
      status: 'IN_PROGRESS',
      createdAt,
    });
    await Promise.all(
      players.map((player, index) =>
        ctx.db.insert('roomPlayers', {
          roomId,
          userId: userIds[index],
          displayName: player.name,
          seatIndex: index,
          joinedAt: createdAt,
        })
      )
    );

    const matrix = WORD_COUNTS.map((_, round) =>
      userIds.map((_, poem) => userIds[(poem + round) % userIds.length])
    );
    const gameId = await ctx.db.insert('games', {
      roomId,
      status: 'IN_PROGRESS',
      cycle: 1,
      currentRound: 0,
      roundStartedAt: createdAt,
      assignmentMatrix: matrix,
      createdAt,
    });
    const poemIds: Id<'poems'>[] = [];
    for (let index = 0; index < players.length; index += 1) {
      poemIds.push(
        await ctx.db.insert('poems', {
          roomId,
          gameId,
          indexInRoom: index,
          createdAt,
        })
      );
    }

    return { roomId, gameId, userIds, poemIds, matrix };
  });
}

async function getGameLines(t: T, gameId: Id<'games'>) {
  return t.run(async (ctx) => {
    const poems = await ctx.db
      .query('poems')
      .withIndex('by_game', (q) => q.eq('gameId', gameId))
      .collect();
    const lines = await Promise.all(
      poems.map((poem) =>
        ctx.db
          .query('lines')
          .withIndex('by_poem', (q) => q.eq('poemId', poem._id))
          .collect()
      )
    );
    return lines.flat() as Doc<'lines'>[];
  });
}

const testEnv = {
  ...env.original,
  OPENROUTER_API_KEY: 'test-openrouter-key',
  CANARY_API_KEY: 'test-canary-key',
};

beforeEach(() => {
  process.env = { ...testEnv };
  delete process.env.AI_DAILY_CALL_BUDGET;
  delete process.env.AI_DAILY_CALL_ALERT_THRESHOLD;
  delete process.env.AI_PROVIDER_ENABLED;
  vi.useFakeTimers();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes('openrouter.ai')) {
        return new Response(
          JSON.stringify({
            model: 'test-model',
            choices: [
              { message: { content: 'moonlight' }, finish_reason: 'stop' },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.includes('/api/v1/errors') || url.includes('/api/v1/check-ins')) {
        return new Response('{}', { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    })
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

afterAll(() => {
  process.env = env.original;
});

describe('shared bot and ghost generation budget', () => {
  it.each([
    [undefined, 'enabled_default', 2, 2],
    ['   ', 'enabled_default', 2, 2],
    ['1', 'enabled', 2, 2],
    ['false', 'disabled', 0, 0],
    ['0', 'disabled', 0, 0],
    ['typo', 'invalid', 0, 0],
  ] as const)(
    'applies AI_PROVIDER_ENABLED=%s as %s without bypassing the shared guard',
    async (
      switchValue,
      expectedSwitchState,
      expectedProviderCalls,
      expectedClaims
    ) => {
      if (switchValue === undefined) delete process.env.AI_PROVIDER_ENABLED;
      else process.env.AI_PROVIDER_ENABLED = switchValue;
      expect(getAiBudgetConfig().providerSwitchState).toBe(expectedSwitchState);
      const t = setupConvexTest();
      const { roomId, gameId, userIds, poemIds } = await seedGame(t, [
        { name: 'Ada' },
        { name: 'Bo', kind: 'AI', aiPersonaId: 'bashō' },
      ]);

      await t.action(internal.ai.generateGhostLine, {
        roomId,
        gameId,
        round: 0,
        poemId: poemIds[0],
        forUserId: userIds[0],
      });
      await t.mutation(internal.ai.scheduleAiTurn, {
        roomId,
        gameId,
        round: 0,
      });
      if (expectedProviderCalls > 0) {
        await t.action(internal.ai.generateLineForRound, {
          roomId,
          gameId,
          round: 0,
        });
      }

      const providerCalls = vi
        .mocked(fetch)
        .mock.calls.filter(([input]) =>
          String(input).includes('openrouter.ai')
        );
      expect(providerCalls).toHaveLength(expectedProviderCalls);
      const usage = await t.run((ctx) => ctx.db.query('aiUsage').first());
      expect(usage?.generationClaims ?? 0).toBe(expectedClaims);
      expect(usage?.fallbacks ?? 0).toBe(expectedProviderCalls === 0 ? 2 : 0);
      expect(await getGameLines(t, gameId)).toHaveLength(2);
    }
  );

  it('allows at most one provider call for concurrent attempts on one cell', async () => {
    const t = setupConvexTest();
    const { roomId, gameId, userIds, poemIds } = await seedGame(t, [
      { name: 'Ada' },
      { name: 'Bo' },
    ]);
    const args = {
      roomId,
      gameId,
      round: 0,
      poemId: poemIds[0],
      forUserId: userIds[0],
    };

    await Promise.all([
      t.action(internal.ai.generateGhostLine, args),
      t.action(internal.ai.generateGhostLine, args),
    ]);

    const providerCalls = vi
      .mocked(fetch)
      .mock.calls.filter(([input]) => String(input).includes('openrouter.ai'));
    expect(providerCalls).toHaveLength(1);
    const turns = await t.run((ctx) =>
      ctx.db
        .query('aiTurns')
        .withIndex('by_cell', (q) => q.eq('poemId', poemIds[0]).eq('round', 0))
        .collect()
    );
    expect(turns).toHaveLength(1);
  });

  it('rejects ghost claims for AI-assigned cells before provider work', async () => {
    const t = setupConvexTest();
    const { roomId, gameId, userIds, poemIds } = await seedGame(t, [
      { name: 'Host' },
      { name: 'Bot', kind: 'AI', aiPersonaId: 'bashō' },
    ]);

    const claim = await t.mutation(internal.ai.claimGhostGeneration, {
      roomId,
      gameId,
      round: 0,
      poemId: poemIds[1],
      forUserId: userIds[1],
    });

    expect(claim.status).toBe('rejected');
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('aiTurns')
          .withIndex('by_cell', (q) =>
            q.eq('poemId', poemIds[1]).eq('round', 0)
          )
          .first()
      )
    ).toBeNull();
    expect(
      vi
        .mocked(fetch)
        .mock.calls.filter(([input]) => String(input).includes('openrouter.ai'))
    ).toHaveLength(0);
  });

  it('completes a full abandoned human game at zero budget without a provider call', async () => {
    process.env.AI_DAILY_CALL_BUDGET = '0';
    const t = setupConvexTest();
    const { roomId, gameId } = await seedGame(t, [
      { name: 'Ada' },
      { name: 'Bo' },
    ]);

    await t.mutation(internal.game.fillStaleHumanTurns, {
      roomId,
      gameId,
      round: 0,
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const game = await t.run((ctx) => ctx.db.get(gameId));
    expect(game?.status).toBe('COMPLETED');
    expect(await getGameLines(t, gameId)).toHaveLength(WORD_COUNTS.length * 2);
    expect(
      vi
        .mocked(fetch)
        .mock.calls.filter(([input]) => String(input).includes('openrouter.ai'))
    ).toHaveLength(0);
    const usage = await t.run((ctx) => ctx.db.query('aiUsage').first());
    expect(usage?.generationClaims).toBe(0);
    expect(usage?.fallbacks).toBe(WORD_COUNTS.length * 2);
  });

  it('emits one Canary alert when combined bot and ghost claims cross the threshold', async () => {
    process.env.AI_DAILY_CALL_ALERT_THRESHOLD = '2';
    const t = setupConvexTest();
    const { roomId, gameId, userIds, poemIds } = await seedGame(t, [
      { name: 'Ada' },
      { name: 'Bot', kind: 'AI', aiPersonaId: 'bashō' },
    ]);

    await t.mutation(internal.ai.scheduleAiTurn, {
      roomId,
      gameId,
      round: 0,
    });
    const ghostClaim = await t.mutation(internal.ai.claimGhostGeneration, {
      roomId,
      gameId,
      round: 0,
      poemId: poemIds[0],
      forUserId: userIds[0],
    });
    expect(ghostClaim.status).toBe('authorized');

    vi.advanceTimersByTime(0);
    await t.finishInProgressScheduledFunctions();

    const usage = await t.run((ctx) => ctx.db.query('aiUsage').first());
    expect(usage?.generationClaims).toBe(2);
    const alertCalls = vi
      .mocked(fetch)
      .mock.calls.filter(([input]) => String(input).includes('/api/v1/errors'));
    expect(alertCalls).toHaveLength(1);
    const alertBody = JSON.parse(
      String((alertCalls[0][1] as RequestInit | undefined)?.body)
    ) as { message: string; context?: { operation?: string } };
    expect(alertBody.message).toBe('AI generation claim threshold reached');
    expect(alertBody.context?.operation).toBe('aiGenerationBudgetThreshold');
  });
});
