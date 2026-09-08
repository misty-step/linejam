/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseFlags, run } from '@/scripts/cli/linejam-cli';
import type { LinejamClient } from '@/scripts/lib/linejamClient';
import { AVATAR_IDS } from '@/lib/avatars';
import { verifyGuestToken } from '@/lib/guestToken';

const initialExitCode = process.exitCode;

beforeEach(() => {
  vi.stubEnv('LINEJAM_GUEST_TOKEN', undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  process.exitCode = initialExitCode;
});

function fakeClient(overrides: Partial<LinejamClient> = {}): LinejamClient {
  // SAFETY: Test fixture stubs all LinejamClient methods with Vitest mocks for CLI dispatch tests.
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
  } as LinejamClient;
}

describe('parseFlags', () => {
  it('gives --guest-token precedence over the environment identity', () => {
    vi.stubEnv('LINEJAM_GUEST_TOKEN', 'env-token');
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
  });

  it('keeps positionals in order across multiple non-flag args', () => {
    expect(parseFlags(['poem1', '0', 'hello', 'world'])).toEqual({
      positionals: ['poem1', '0', 'hello', 'world'],
      guestToken: undefined,
    });
  });

  it('accepts every supported avatar without consuming names or other flags', () => {
    for (const avatarId of AVATAR_IDS) {
      expect(
        parseFlags([
          'ABCD',
          '--avatar',
          avatarId,
          'Ada Lovelace',
          '--guest-token',
          'player-token',
        ])
      ).toEqual({
        positionals: ['ABCD', 'Ada Lovelace'],
        avatarId,
        guestToken: 'player-token',
      });
    }
  });

  it('names every valid choice when an avatar is unknown, empty, or missing', () => {
    for (const value of ['not-an-avatar', '', undefined]) {
      let error: unknown;
      try {
        parseFlags(value === undefined ? ['--avatar'] : ['--avatar', value]);
      } catch (caught) {
        error = caught;
      }

      expect(error).toBeInstanceOf(Error);
      for (const avatarId of AVATAR_IDS) {
        expect(error).toHaveProperty(
          'message',
          expect.stringContaining(avatarId)
        );
      }
    }
  });
});

describe('run', () => {
  let stdout: string[];
  let stderr: string[];

  beforeEach(() => {
    stdout = [];
    stderr = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      stdout.push(String(chunk));
      return true;
    });
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      stderr.push(String(chunk));
      return true;
    });
  });

  it('creates a room with the chosen name, avatar, and explicit identity', async () => {
    vi.stubEnv('LINEJAM_GUEST_TOKEN', 'environment-player');
    const client = fakeClient();

    await run(
      [
        'room',
        'create',
        'Ada Lovelace',
        '--avatar',
        'moss',
        '--guest-token',
        'host-token',
      ],
      client
    );

    expect(client.createRoom).toHaveBeenCalledExactlyOnceWith({
      displayName: 'Ada Lovelace',
      avatarId: 'moss',
      guestToken: 'host-token',
    });
    expect(stderr).toEqual([]);
  });

  it('joins a room with the chosen avatar and the environment identity', async () => {
    vi.stubEnv('LINEJAM_GUEST_TOKEN', 'returning-player');
    const client = fakeClient();

    await run(
      ['room', 'join', 'WXYZ', '--avatar', 'plum', 'Grace Hopper'],
      client
    );

    expect(client.joinRoom).toHaveBeenCalledExactlyOnceWith({
      code: 'WXYZ',
      displayName: 'Grace Hopper',
      avatarId: 'plum',
      guestToken: 'returning-player',
    });
    expect(stderr).toEqual([]);
  });

  it('prints a signed, reusable guest identity only to stderr when creating without a token', async () => {
    vi.stubEnv('GUEST_TOKEN_SECRET', 'cli-tests-only-guest-token-secret');
    const client = fakeClient();

    await run(['room', 'create', 'Guest Poet'], client);

    const instructions = stderr.join('');
    const guestToken = /--guest-token (\S+)\s*$/m.exec(instructions)?.[1];
    if (!guestToken) {
      throw new Error('Expected a reusable --guest-token in stderr');
    }
    const guestId = await verifyGuestToken(guestToken);
    expect(instructions).toContain(guestId);
    expect(stdout.join('')).not.toContain(guestToken);
    expect(stdout.join('')).not.toContain(guestId);
    expect(JSON.parse(stdout.join(''))).not.toHaveProperty('guestToken');
    expect(client.createRoom).toHaveBeenCalledExactlyOnceWith({
      displayName: 'Guest Poet',
      avatarId: undefined,
      guestToken,
    });

    stderr.length = 0;
    await run(['room', 'state', 'ABCD', '--guest-token', guestToken], client);
    expect(client.getRoomState).toHaveBeenCalledExactlyOnceWith({
      code: 'ABCD',
      guestToken,
    });
    expect(stderr).toEqual([]);
  });

  it('leaves a returning player avatar unchanged when --avatar is omitted', async () => {
    const client = fakeClient();
    await run(
      [
        'room',
        'join',
        'ABCD',
        'Guest Poet',
        '--guest-token',
        'returning-player',
      ],
      client
    );

    expect(client.joinRoom).toHaveBeenCalledExactlyOnceWith({
      code: 'ABCD',
      displayName: 'Guest Poet',
      avatarId: undefined,
      guestToken: 'returning-player',
    });
  });

  it('routes "room state" to client.getRoomState', async () => {
    const client = fakeClient();
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
    expect(JSON.parse(stdout.join(''))).toEqual({ ok: true });
  });

  it('routes "favorites list" to client.getMyFavorites', async () => {
    const client = fakeClient();
    await run(['favorites', 'list', '--guest-token', 'tok'], client);
    expect(client.getMyFavorites).toHaveBeenCalledWith({ guestToken: 'tok' });
  });

  it('shows command and identity help without requiring a configured deployment', async () => {
    vi.stubEnv('NEXT_PUBLIC_CONVEX_URL', undefined);
    for (const argv of [[], ['--help'], ['-h']]) {
      stdout.length = 0;
      // Omitting the injected client exercises help before client construction.
      await run(argv);
      const help = stdout.join('');
      expect(help).toContain('room create <displayName>');
      expect(help).toContain('room join <code> <displayName>');
      expect(help).toContain('game submit-line <poemId> <lineIndex> <text>');
      expect(help).toContain('--avatar');
      expect(help).toContain('--guest-token');
      expect(help).toContain('LINEJAM_GUEST_TOKEN');
      for (const avatarId of AVATAR_IDS) {
        expect(help).toContain(avatarId);
      }
      expect(stderr).toEqual([]);
    }
  });

  it('reports an unknown command with usage and a nonzero exit status', async () => {
    await run(['nonsense'], fakeClient());
    expect(process.exitCode).toBe(1);
    expect(stdout.join('')).toContain('room create <displayName>');
    expect(stdout.join('')).toContain('favorites list');
  });

  it('shows the available subcommands when the action is missing', async () => {
    await run(['game'], fakeClient());
    expect(process.exitCode).toBe(1);
    expect(stdout.join('')).toContain('game start <code>');
    expect(stdout.join('')).toContain('game assignment <code>');
    expect(stdout.join('')).toContain(
      'game submit-line <poemId> <lineIndex> <text>'
    );
  });

  it.each([
    {
      argv: ['room', 'create'],
      usage: 'room create <displayName>',
      boundary: 'createRoom',
    },
    {
      argv: ['room', 'join'],
      usage: 'room join <code> <displayName>',
      boundary: 'joinRoom',
    },
    {
      argv: ['room', 'join', 'ABCD'],
      usage: 'room join <code> <displayName>',
      boundary: 'joinRoom',
    },
    {
      argv: ['room', 'state'],
      usage: 'room state <code>',
      boundary: 'getRoomState',
    },
    {
      argv: ['game', 'start'],
      usage: 'game start <code>',
      boundary: 'startGame',
    },
    {
      argv: ['game', 'assignment'],
      usage: 'game assignment <code>',
      boundary: 'getCurrentAssignment',
    },
    {
      argv: ['game', 'submit-line'],
      usage: 'game submit-line <poemId> <lineIndex> <text',
      boundary: 'submitLine',
    },
    {
      argv: ['game', 'submit-line', 'poem1'],
      usage: 'game submit-line <poemId> <lineIndex> <text',
      boundary: 'submitLine',
    },
    {
      argv: ['game', 'submit-line', 'poem1', '0'],
      usage: 'game submit-line <poemId> <lineIndex> <text',
      boundary: 'submitLine',
    },
    {
      argv: ['poems', 'list'],
      usage: 'poems list <roomCode>',
      boundary: 'getPoemsForRoom',
    },
    {
      argv: ['poems', 'get'],
      usage: 'poems get <poemId>',
      boundary: 'getPoemDetail',
    },
    {
      argv: ['favorites', 'toggle'],
      usage: 'favorites toggle <poemId>',
      boundary: 'toggleFavorite',
    },
  ] satisfies {
    argv: string[];
    usage: string;
    boundary: keyof LinejamClient;
  }[])(
    'reports positional usage before calling the backend for $argv',
    async ({ argv, usage, boundary }) => {
      const client = fakeClient();
      await expect(
        run([...argv, '--guest-token', 'player-token'], client)
      ).rejects.toThrow(usage);
      expect(client[boundary]).not.toHaveBeenCalled();
      expect(stdout).toEqual([]);
    }
  );

  it.each([
    { argv: ['room', 'state', 'ABCD'], boundary: 'getRoomState' },
    { argv: ['game', 'start', 'ABCD'], boundary: 'startGame' },
    { argv: ['game', 'assignment', 'ABCD'], boundary: 'getCurrentAssignment' },
    {
      argv: ['game', 'submit-line', 'poem1', '0', 'moonlight'],
      boundary: 'submitLine',
    },
    { argv: ['poems', 'list', 'ABCD'], boundary: 'getPoemsForRoom' },
    { argv: ['poems', 'get', 'poem1'], boundary: 'getPoemDetail' },
    { argv: ['favorites', 'toggle', 'poem1'], boundary: 'toggleFavorite' },
    { argv: ['favorites', 'list'], boundary: 'getMyFavorites' },
  ] satisfies {
    argv: string[];
    boundary: keyof LinejamClient;
  }[])(
    'requires an existing player identity for $argv',
    async ({ argv, boundary }) => {
      const client = fakeClient();
      await expect(run(argv, client)).rejects.toThrow(/--guest-token/);
      expect(client[boundary]).not.toHaveBeenCalled();
      expect(stdout).toEqual([]);
      expect(stderr).toEqual([]);
    }
  );

  it('does not silently use the environment identity for an empty --guest-token flag', async () => {
    vi.stubEnv('LINEJAM_GUEST_TOKEN', 'environment-player');
    const client = fakeClient();
    for (const tokenArgs of [['--guest-token'], ['--guest-token', '']]) {
      await expect(
        run(['room', 'state', 'ABCD', ...tokenArgs], client)
      ).rejects.toThrow(/--guest-token/);
    }
    expect(client.getRoomState).not.toHaveBeenCalled();
    expect(stdout).toEqual([]);
  });
});
