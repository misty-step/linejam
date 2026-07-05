/** @vitest-environment node */
import { describe, expect, it, vi } from 'vitest';
import { parseFlags, run } from '@/scripts/cli/linejam-cli';

function fakeClient(overrides: Record<string, unknown> = {}) {
  return {
    createRoom: vi.fn().mockResolvedValue({ code: 'ABCD', roomId: 'room1' }),
    joinRoom: vi.fn().mockResolvedValue({ code: 'ABCD' }),
    getRoomState: vi
      .fn()
      .mockResolvedValue({ room: {}, players: [], isHost: false }),
    startGame: vi.fn().mockResolvedValue(null),
    getCurrentAssignment: vi
      .fn()
      .mockResolvedValue({ poemId: 'poem1', lineIndex: 0 }),
    submitLine: vi.fn().mockResolvedValue(null),
    getPoemsForRoom: vi.fn().mockResolvedValue([]),
    getPoemDetail: vi.fn().mockResolvedValue({ poem: {}, lines: [] }),
    toggleFavorite: vi.fn().mockResolvedValue(null),
    getMyFavorites: vi.fn().mockResolvedValue([]),
    ...overrides,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe('parseFlags', () => {
  it('separates --guest-token from positional args', () => {
    expect(parseFlags(['MZVJ', '--guest-token', 'tok123'])).toEqual({
      positionals: ['MZVJ'],
      guestToken: 'tok123',
    });
  });

  it('falls back to LINEJAM_GUEST_TOKEN when no flag is given', () => {
    vi.stubEnv('LINEJAM_GUEST_TOKEN', 'env-token');
    expect(parseFlags(['MZVJ'])).toEqual({
      positionals: ['MZVJ'],
      guestToken: 'env-token',
    });
    vi.unstubAllEnvs();
  });

  it('keeps positionals in order across multiple non-flag args', () => {
    expect(parseFlags(['poem1', '0', 'hello', 'world'])).toEqual({
      positionals: ['poem1', '0', 'hello', 'world'],
      guestToken: undefined,
    });
  });
});

describe('run', () => {
  it('routes "room create" to client.createRoom with a resolved guest token', async () => {
    const client = fakeClient();
    await run(['room', 'create', 'Alice', '--guest-token', 'tok'], client);
    expect(client.createRoom).toHaveBeenCalledWith({
      displayName: 'Alice',
      guestToken: 'tok',
    });
  });

  it('routes "room join" to client.joinRoom', async () => {
    const client = fakeClient();
    await run(['room', 'join', 'ABCD', 'Bob', '--guest-token', 'tok'], client);
    expect(client.joinRoom).toHaveBeenCalledWith({
      code: 'ABCD',
      displayName: 'Bob',
      guestToken: 'tok',
    });
  });

  it('routes "room state" to client.getRoomState and requires a guest token', async () => {
    const client = fakeClient();
    await expect(run(['room', 'state', 'ABCD'], client)).rejects.toThrow(
      /requires --guest-token/
    );
    await run(['room', 'state', 'ABCD', '--guest-token', 'tok'], client);
    expect(client.getRoomState).toHaveBeenCalledWith({
      code: 'ABCD',
      guestToken: 'tok',
    });
  });

  it('routes "game start" to client.startGame', async () => {
    const client = fakeClient();
    await run(['game', 'start', 'ABCD', '--guest-token', 'tok'], client);
    expect(client.startGame).toHaveBeenCalledWith({
      code: 'ABCD',
      guestToken: 'tok',
    });
  });

  it('routes "game assignment" to client.getCurrentAssignment', async () => {
    const client = fakeClient();
    await run(['game', 'assignment', 'ABCD', '--guest-token', 'tok'], client);
    expect(client.getCurrentAssignment).toHaveBeenCalledWith({
      roomCode: 'ABCD',
      guestToken: 'tok',
    });
  });

  it('routes "game submit-line" to client.submitLine with a numeric lineIndex and joined text', async () => {
    const client = fakeClient();
    await run(
      [
        'game',
        'submit-line',
        'poem1',
        '2',
        'hello',
        'world',
        '--guest-token',
        'tok',
      ],
      client
    );
    expect(client.submitLine).toHaveBeenCalledWith({
      poemId: 'poem1',
      lineIndex: 2,
      text: 'hello world',
      guestToken: 'tok',
    });
  });

  it('routes "poems list" to client.getPoemsForRoom', async () => {
    const client = fakeClient();
    await run(['poems', 'list', 'ABCD', '--guest-token', 'tok'], client);
    expect(client.getPoemsForRoom).toHaveBeenCalledWith({
      roomCode: 'ABCD',
      guestToken: 'tok',
    });
  });

  it('routes "poems get" to client.getPoemDetail', async () => {
    const client = fakeClient();
    await run(['poems', 'get', 'poem1', '--guest-token', 'tok'], client);
    expect(client.getPoemDetail).toHaveBeenCalledWith({
      poemId: 'poem1',
      guestToken: 'tok',
    });
  });

  it('routes "favorites toggle" to client.toggleFavorite', async () => {
    const client = fakeClient();
    await run(['favorites', 'toggle', 'poem1', '--guest-token', 'tok'], client);
    expect(client.toggleFavorite).toHaveBeenCalledWith({
      poemId: 'poem1',
      guestToken: 'tok',
    });
  });

  it('routes "favorites list" to client.getMyFavorites', async () => {
    const client = fakeClient();
    await run(['favorites', 'list', '--guest-token', 'tok'], client);
    expect(client.getMyFavorites).toHaveBeenCalledWith({ guestToken: 'tok' });
  });

  it('prints help and never constructs a client for --help', async () => {
    // No client argument at all: if run() eagerly built a real client here,
    // this would throw (no NEXT_PUBLIC_CONVEX_URL in the test environment).
    await expect(run(['--help'])).resolves.toBeUndefined();
    await expect(run([])).resolves.toBeUndefined();
  });

  it('exits non-zero on an unrecognized command', async () => {
    const client = fakeClient();
    await run(['nonsense'], client);
    expect(process.exitCode).toBe(1);
    process.exitCode = 0;
  });
});
