import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../convex/_generated/server', () => ({
  mutation: (args: unknown) => args,
  query: (args: unknown) => args,
  internalMutation: (args: unknown) => args,
}));

const mockGetUser = vi.fn();
const mockCheckParticipation = vi.fn();
vi.mock('../../convex/lib/auth', () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
  checkParticipation: (...args: unknown[]) => mockCheckParticipation(...args),
}));

vi.mock('../../convex/users', () => ({
  ensureUserHelper: vi.fn(),
}));

vi.mock('../../convex/lib/rateLimit', () => ({
  checkRateLimit: vi.fn(),
}));

import { startNewCycle } from '../../convex/game';
import { getRoomState } from '../../convex/rooms';

const startNewCycleHandler = (
  startNewCycle as unknown as {
    handler: (ctx: unknown, args: unknown) => Promise<void>;
  }
).handler;

const getRoomStateHandler = (
  getRoomState as unknown as {
    handler: (
      ctx: unknown,
      args: unknown
    ) => Promise<{
      room: { status: 'LOBBY' | 'IN_PROGRESS' | 'COMPLETED' };
    } | null>;
  }
).handler;

function createStatefulCtx() {
  const state = {
    room: {
      _id: 'room1',
      code: 'TEST',
      hostUserId: 'user1',
      status: 'COMPLETED' as const,
      currentGameId: 'game1',
    },
    games: [
      {
        _id: 'game1',
        roomId: 'room1',
        status: 'COMPLETED' as const,
      },
    ],
    roomPlayers: [
      {
        _id: 'player1',
        roomId: 'room1',
        userId: 'user1',
        displayName: 'Alice',
        joinedAt: 1,
      },
    ],
    users: new Map([
      [
        'user1',
        {
          _id: 'user1',
          kind: 'HUMAN',
        },
      ],
    ]),
  };

  const db = {
    query(table: string) {
      const filters = new Map<string, unknown>();
      let direction: 'asc' | 'desc' = 'asc';
      const queryBuilder = {
        eq(field: string, value: unknown) {
          filters.set(field, value);
          return queryBuilder;
        },
      };
      const builder = {
        withIndex(
          _indexName: string,
          callback?: (q: typeof queryBuilder) => unknown
        ) {
          callback?.(queryBuilder);
          return builder;
        },
        order(nextDirection: 'asc' | 'desc') {
          direction = nextDirection;
          return builder;
        },
        async first() {
          if (table === 'rooms') {
            return filters.get('code') === state.room.code ? state.room : null;
          }

          if (table === 'games') {
            const matches = state.games.filter(
              (game) =>
                game.roomId === filters.get('roomId') &&
                game.status === filters.get('status')
            );
            if (direction === 'desc') {
              return matches.at(-1) ?? null;
            }
            return matches[0] ?? null;
          }

          return null;
        },
        async collect() {
          if (table === 'roomPlayers') {
            return state.roomPlayers.filter(
              (player) => player.roomId === filters.get('roomId')
            );
          }

          return [];
        },
      };
      return builder;
    },
    patch: vi.fn(async (id: string, value: Record<string, unknown>) => {
      if (id === state.room._id) {
        state.room = { ...state.room, ...value };
      }
    }),
    get: vi.fn(async (id: string) => state.users.get(id) ?? null),
  };

  return {
    ctx: {
      db,
      auth: { getUserIdentity: vi.fn() },
    },
    state,
  };
}

describe('room lifecycle', () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockCheckParticipation.mockReset();
  });

  it('returns LOBBY after startNewCycle resets a completed room', async () => {
    const { ctx, state } = createStatefulCtx();
    mockGetUser.mockResolvedValue({ _id: 'user1' });
    mockCheckParticipation.mockResolvedValue(true);

    await startNewCycleHandler(ctx, {
      roomCode: 'TEST',
      guestToken: 'token123',
    });

    const result = await getRoomStateHandler(ctx, {
      code: 'TEST',
      guestToken: 'token123',
    });

    expect(state.room.status).toBe('LOBBY');
    expect(state.room.currentGameId).toBeUndefined();
    expect(result?.room.status).toBe('LOBBY');
  });
});
