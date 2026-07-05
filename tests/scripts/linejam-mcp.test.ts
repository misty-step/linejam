/** @vitest-environment node */
import { describe, expect, it, vi } from 'vitest';
import { callTool, handleRequest, TOOLS } from '@/scripts/mcp/linejam-mcp';

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
});

describe('callTool', () => {
  it('mints a guest identity without needing a client at all', async () => {
    const result = (await callTool('linejam_mint_guest', {})) as {
      guestId: string;
      guestToken: string;
    };
    expect(result.guestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(typeof result.guestToken).toBe('string');
  });

  it('routes linejam_create_room to client.createRoom', async () => {
    const client = fakeClient();
    await callTool(
      'linejam_create_room',
      { displayName: 'Alice', guestToken: 'tok' },
      client
    );
    expect(client.createRoom).toHaveBeenCalledWith({
      displayName: 'Alice',
      guestToken: 'tok',
    });
  });

  it('routes linejam_submit_line to client.submitLine', async () => {
    const client = fakeClient();
    await callTool(
      'linejam_submit_line',
      { poemId: 'poem1', lineIndex: 1, text: 'hello', guestToken: 'tok' },
      client
    );
    expect(client.submitLine).toHaveBeenCalledWith({
      poemId: 'poem1',
      lineIndex: 1,
      text: 'hello',
      guestToken: 'tok',
    });
  });

  it('routes linejam_list_favorites to client.getMyFavorites', async () => {
    const client = fakeClient();
    await callTool('linejam_list_favorites', { guestToken: 'tok' }, client);
    expect(client.getMyFavorites).toHaveBeenCalledWith({ guestToken: 'tok' });
  });

  it('throws on an unknown tool name', async () => {
    const client = fakeClient();
    await expect(callTool('nonsense', {}, client)).rejects.toThrow(
      /unknown tool/
    );
  });
});

describe('handleRequest', () => {
  function capturedStdout() {
    const chunks: string[] = [];
    const spy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk: unknown) => {
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
    expect(msg.result.tools).toHaveLength(TOOLS.length);
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
});
