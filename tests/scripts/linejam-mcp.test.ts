/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  callTool,
  handleRequest,
  TOOLS,
  type LinejamToolArgs,
} from '@/scripts/mcp/linejam-mcp';
import type { LinejamClient } from '@/scripts/lib/linejamClient';
import { AVATAR_IDS } from '@/lib/avatars';
import { verifyGuestToken } from '@/lib/guestToken';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

function fakeClient(overrides: Partial<LinejamClient> = {}): LinejamClient {
  // SAFETY: Test fixture stubs all LinejamClient methods with Vitest mocks for MCP tool tests.
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

describe('TOOLS', () => {
  it('advertises exactly the eleven agent-facing tools', () => {
    const names = TOOLS.map((tool) => tool.name).sort();
    expect(names).toEqual(
      [
        'linejam_create_room',
        'linejam_current_assignment',
        'linejam_get_poem',
        'linejam_join_room',
        'linejam_list_favorites',
        'linejam_list_poems',
        'linejam_mint_guest',
        'linejam_room_state',
        'linejam_start_game',
        'linejam_submit_line',
        'linejam_toggle_favorite',
      ].sort()
    );
  });

  it('every tool except mint_guest requires guestToken', () => {
    for (const tool of TOOLS) {
      if (tool.name === 'linejam_mint_guest') continue;
      expect(tool.inputSchema.required).toContain('guestToken');
    }
  });

  it('advertises the supported optional avatars for creating and joining rooms', () => {
    for (const name of ['linejam_create_room', 'linejam_join_room']) {
      const tool = TOOLS.find((candidate) => candidate.name === name);
      expect(tool?.inputSchema.properties.avatarId).toEqual(
        expect.objectContaining({ type: 'string', enum: AVATAR_IDS })
      );
      expect(tool?.inputSchema.required).not.toContain('avatarId');
    }
  });
});

describe('callTool', () => {
  it('mints a verifiable guest identity without a configured deployment or client', async () => {
    vi.stubEnv('NEXT_PUBLIC_CONVEX_URL', undefined);
    // SAFETY: This tool returns the guest identity, rather than a Convex result.
    const result = (await callTool('linejam_mint_guest')) as {
      guestId: string;
      guestToken: string;
    };
    expect(result.guestId).toMatch(/^[0-9a-f-]{36}$/);
    await expect(verifyGuestToken(result.guestToken)).resolves.toBe(
      result.guestId
    );
  });

  it('creates a room with the requested host identity and avatar', async () => {
    const client = fakeClient();
    await callTool(
      'linejam_create_room',
      { displayName: 'Ada', avatarId: 'moss', guestToken: 'host-token' },
      client
    );
    expect(client.createRoom).toHaveBeenCalledExactlyOnceWith({
      displayName: 'Ada',
      avatarId: 'moss',
      guestToken: 'host-token',
    });
  });

  it('joins the requested room with the chosen player identity and avatar', async () => {
    const client = fakeClient();
    await callTool(
      'linejam_join_room',
      {
        code: 'ABCD',
        displayName: 'Grace',
        avatarId: 'plum',
        guestToken: 'player-token',
      },
      client
    );
    expect(client.joinRoom).toHaveBeenCalledExactlyOnceWith({
      code: 'ABCD',
      displayName: 'Grace',
      avatarId: 'plum',
      guestToken: 'player-token',
    });
  });

  it('leaves avatar selection to the room when the caller omits it', async () => {
    const client = fakeClient();
    await callTool(
      'linejam_join_room',
      { code: 'ABCD', displayName: 'Grace', guestToken: 'player-token' },
      client
    );
    expect(client.joinRoom).toHaveBeenCalledExactlyOnceWith({
      code: 'ABCD',
      displayName: 'Grace',
      avatarId: undefined,
      guestToken: 'player-token',
    });
  });

  it('rejects an unknown avatar before joining and names all valid choices', async () => {
    const client = fakeClient();
    const result = callTool(
      'linejam_join_room',
      {
        code: 'ABCD',
        displayName: 'Grace',
        avatarId: 'dragon',
        guestToken: 'player-token',
      },
      client
    );
    await expect(result).rejects.toThrow(/avatar/i);
    for (const avatarId of AVATAR_IDS) {
      await expect(result).rejects.toThrow(avatarId);
    }
    expect(client.joinRoom).not.toHaveBeenCalled();
  });

  it('reads the requested room as the calling guest', async () => {
    const client = fakeClient();
    await callTool(
      'linejam_room_state',
      { code: 'ABCD', guestToken: 'player-token' },
      client
    );
    expect(client.getRoomState).toHaveBeenCalledExactlyOnceWith({
      code: 'ABCD',
      guestToken: 'player-token',
    });
  });

  it('requests a game start in the selected room as the host', async () => {
    const client = fakeClient();
    await callTool(
      'linejam_start_game',
      { code: 'ABCD', guestToken: 'host-token' },
      client
    );
    expect(client.startGame).toHaveBeenCalledExactlyOnceWith({
      code: 'ABCD',
      guestToken: 'host-token',
    });
  });

  it('requests the guest assignment using roomCode rather than code', async () => {
    const client = fakeClient();
    await callTool(
      'linejam_current_assignment',
      { roomCode: 'ABCD', guestToken: 'player-token' },
      client
    );
    expect(client.getCurrentAssignment).toHaveBeenCalledExactlyOnceWith({
      roomCode: 'ABCD',
      guestToken: 'player-token',
    });
  });

  it('submits line zero without changing the author text', async () => {
    const client = fakeClient();
    await callTool(
      'linejam_submit_line',
      {
        poemId: 'poem1',
        lineIndex: 0,
        text: '  Night blooms  ',
        guestToken: 'player-token',
      },
      client
    );
    expect(client.submitLine).toHaveBeenCalledExactlyOnceWith({
      poemId: 'poem1',
      lineIndex: 0,
      text: '  Night blooms  ',
      guestToken: 'player-token',
    });
  });

  it('requests poems from the selected room as the calling guest', async () => {
    const client = fakeClient();
    await callTool(
      'linejam_list_poems',
      { roomCode: 'ABCD', guestToken: 'player-token' },
      client
    );
    expect(client.getPoemsForRoom).toHaveBeenCalledExactlyOnceWith({
      roomCode: 'ABCD',
      guestToken: 'player-token',
    });
  });

  it('requests the complete selected poem as the calling guest', async () => {
    const client = fakeClient();
    await callTool(
      'linejam_get_poem',
      { poemId: 'poem1', guestToken: 'player-token' },
      client
    );
    expect(client.getPoemDetail).toHaveBeenCalledExactlyOnceWith({
      poemId: 'poem1',
      guestToken: 'player-token',
    });
  });

  it('changes the guest favorite for the selected poem', async () => {
    const client = fakeClient();
    await callTool(
      'linejam_toggle_favorite',
      { poemId: 'poem1', guestToken: 'player-token' },
      client
    );
    expect(client.toggleFavorite).toHaveBeenCalledExactlyOnceWith({
      poemId: 'poem1',
      guestToken: 'player-token',
    });
  });

  it('routes linejam_list_favorites to client.getMyFavorites', async () => {
    const client = fakeClient();
    await callTool('linejam_list_favorites', { guestToken: 'tok' }, client);
    expect(client.getMyFavorites).toHaveBeenCalledWith({ guestToken: 'tok' });
  });

  it('names a missing displayName without creating a room', async () => {
    const client = fakeClient();
    await expect(
      callTool('linejam_create_room', { guestToken: 'host-token' }, client)
    ).rejects.toThrow(/required.*displayName/i);
    expect(client.createRoom).not.toHaveBeenCalled();
  });

  it('names an empty code without joining a room', async () => {
    const client = fakeClient();
    await expect(
      callTool(
        'linejam_join_room',
        { code: '', displayName: 'Grace', guestToken: 'player-token' },
        client
      )
    ).rejects.toThrow(/required.*code/i);
    expect(client.joinRoom).not.toHaveBeenCalled();
  });

  it('names a non-string roomCode instead of dispatching malformed JSON arguments', async () => {
    const client = fakeClient();
    // SAFETY: A JSON-RPC peer can send a number where this field is typed as a
    // string; JSON.parse reproduces that payload without asserting a type.
    const malformedArgs: LinejamToolArgs = JSON.parse(
      '{"roomCode":42,"guestToken":"player-token"}'
    );
    await expect(
      callTool('linejam_current_assignment', malformedArgs, client)
    ).rejects.toThrow(/required.*roomCode/i);
    expect(client.getCurrentAssignment).not.toHaveBeenCalled();
  });

  it('names a missing poemId without requesting a poem', async () => {
    const client = fakeClient();
    await expect(
      callTool('linejam_get_poem', { guestToken: 'player-token' }, client)
    ).rejects.toThrow(/required.*poemId/i);
    expect(client.getPoemDetail).not.toHaveBeenCalled();
  });

  it('rejects whitespace-only text before submitting a line', async () => {
    const client = fakeClient();
    await expect(
      callTool(
        'linejam_submit_line',
        {
          poemId: 'poem1',
          lineIndex: 0,
          text: ' \t\n ',
          guestToken: 'player-token',
        },
        client
      )
    ).rejects.toThrow(/required.*text/i);
    expect(client.submitLine).not.toHaveBeenCalled();
  });

  it('requires a lineIndex rather than silently submitting line zero', async () => {
    const client = fakeClient();
    await expect(
      callTool(
        'linejam_submit_line',
        { poemId: 'poem1', text: 'Night', guestToken: 'player-token' },
        client
      )
    ).rejects.toThrow(/required.*lineIndex/i);
    expect(client.submitLine).not.toHaveBeenCalled();
  });

  it('rejects a non-finite lineIndex before sending it to the backend', async () => {
    const client = fakeClient();
    await expect(
      callTool(
        'linejam_submit_line',
        {
          poemId: 'poem1',
          lineIndex: Number.NaN,
          text: 'Night',
          guestToken: 'player-token',
        },
        client
      )
    ).rejects.toThrow(/required.*lineIndex/i);
    expect(client.submitLine).not.toHaveBeenCalled();
  });

  it('throws on an unknown tool name', async () => {
    const client = fakeClient();
    await expect(callTool('nonsense', {}, client)).rejects.toThrow(
      /unknown tool.*nonsense/i
    );
  });
});

describe('handleRequest', () => {
  function capturedStdout() {
    const chunks: string[] = [];
    const spy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk: string | Uint8Array) => {
        chunks.push(String(chunk));
        return true;
      });
    return {
      spy,
      lastMessage: () => JSON.parse(chunks[chunks.length - 1]),
    };
  }

  it('answers initialize with server info and a tools capability', async () => {
    const { spy, lastMessage } = capturedStdout();
    await handleRequest({ jsonrpc: '2.0', id: 1, method: 'initialize' });
    const msg = lastMessage();
    expect(msg.id).toBe(1);
    expect(msg.result.serverInfo.name).toBe('linejam-mcp');
    expect(msg.result.capabilities).toEqual({ tools: {} });
    spy.mockRestore();
  });

  it('answers tools/list with the full TOOLS array', async () => {
    const { spy, lastMessage } = capturedStdout();
    await handleRequest({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    const msg = lastMessage();
    expect(msg).toMatchObject({
      jsonrpc: '2.0',
      id: 2,
      result: { tools: TOOLS },
    });
    spy.mockRestore();
  });

  it('replies with a JSON-RPC error for an unknown method', async () => {
    const { spy, lastMessage } = capturedStdout();
    await handleRequest({ jsonrpc: '2.0', id: 3, method: 'bogus/method' });
    const msg = lastMessage();
    expect(msg.error.message).toMatch(/unknown method/);
    spy.mockRestore();
  });

  it('replies with a JSON-RPC error when tools/call has no params.name', async () => {
    const { spy, lastMessage } = capturedStdout();
    await handleRequest({ jsonrpc: '2.0', id: 4, method: 'tools/call' });
    const msg = lastMessage();
    expect(msg.error.message).toMatch(/requires params.name/);
    spy.mockRestore();
  });

  it('returns a usable guest identity as MCP text content without arguments', async () => {
    vi.stubEnv('NEXT_PUBLIC_CONVEX_URL', undefined);
    const { lastMessage } = capturedStdout();
    await handleRequest({
      jsonrpc: '2.0',
      id: 'mint-request',
      method: 'tools/call',
      params: { name: 'linejam_mint_guest' },
    });
    const msg = lastMessage();
    expect(msg).toMatchObject({
      jsonrpc: '2.0',
      id: 'mint-request',
      result: {
        content: [{ type: 'text', text: expect.any(String) }],
      },
    });
    const identity = JSON.parse(msg.result.content[0].text);
    expect(identity.guestId).toMatch(/^[0-9a-f-]{36}$/);
    await expect(verifyGuestToken(identity.guestToken)).resolves.toBe(
      identity.guestId
    );
  });

  it('reports an invalid tool argument as a correlated RPC error and accepts the next request', async () => {
    vi.stubEnv('NEXT_PUBLIC_CONVEX_URL', undefined);
    const { lastMessage } = capturedStdout();
    await handleRequest({
      jsonrpc: '2.0',
      id: 'invalid-avatar',
      method: 'tools/call',
      params: {
        name: 'linejam_create_room',
        arguments: {
          displayName: 'Ada',
          avatarId: 'dragon',
          guestToken: 'host-token',
        },
      },
    });
    const error = lastMessage();
    expect(error).toMatchObject({
      jsonrpc: '2.0',
      id: 'invalid-avatar',
      error: { code: -32000, message: expect.stringMatching(/avatar/i) },
    });
    expect(error.result).toBeUndefined();

    await handleRequest({
      jsonrpc: '2.0',
      id: 'next-request',
      method: 'tools/list',
    });
    expect(lastMessage()).toMatchObject({
      jsonrpc: '2.0',
      id: 'next-request',
      result: { tools: TOOLS },
    });
  });
});
