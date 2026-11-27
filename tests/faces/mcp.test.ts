import { afterEach, describe, expect, inject, it } from 'vitest';
import { Mcp, WORDS, words } from './helpers.ts';

const url = inject('linejamUrl');
let server: Mcp | null = null;

afterEach(async () => {
  await server?.close();
  server = null;
});

describe('[L1-6.4] MCP: initialization, discovery, calls', () => {
  it('initializes and lists tools without touching the game', async () => {
    // Pointed at a closed port: discovery must still work, so it cannot have created anything.
    server = new Mcp('http://127.0.0.1:9');
    const init = await server.request('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'test', version: '0' },
    });
    expect(init.result).toMatchObject({
      protocolVersion: '2025-06-18',
      capabilities: { tools: {} },
      serverInfo: { name: 'linejam-mcp' },
    });
    server.notify('notifications/initialized');
    expect((await server.request('ping')).result).toEqual({});
    const list = await server.request('tools/list');
    const names = list.result.tools.map((t: { name: string }) => t.name);
    expect(names).toEqual([
      'linejam_mint_guest',
      'linejam_create_room',
      'linejam_join_room',
      'linejam_room_state',
      'linejam_start_game',
      'linejam_current_assignment',
      'linejam_submit_line',
      'linejam_reveal_poem',
      'linejam_list_poems',
      'linejam_get_poem',
      'linejam_toggle_favorite',
      'linejam_list_favorites',
    ]);
    for (const tool of list.result.tools) {
      expect(tool.inputSchema.type).toBe('object');
      // Every tool but mint-guest requires an identity.
      if (tool.name !== 'linejam_mint_guest') expect(tool.inputSchema.required).toContain('guestToken');
    }
    expect(server.unsolicited).toEqual([]);
    // An unreachable game is a tool error, not a crash and not a protocol error.
    const unreachable = await server.tool('linejam_mint_guest');
    expect(unreachable.isError).toBe(true);
    expect(unreachable.data.error.code).toBe('unreachable');
  });

  it('answers malformed requests with protocol errors', async () => {
    server = new Mcp(url);
    expect((await server.raw('{not json', null)).error).toEqual({ code: -32700, message: 'Parse error' });
    expect((await server.raw(JSON.stringify({ id: 77, method: 'ping' }), 77)).error.code).toBe(-32600);
    expect((await server.request('rooms/explode')).error.code).toBe(-32601);
    expect((await server.request('tools/call', { name: 'linejam_teleport', arguments: {} })).error.code).toBe(-32602);
    const missing = await server.request('tools/call', { name: 'linejam_create_room', arguments: { penName: 'Ada' } });
    expect(missing.error).toEqual({ code: -32602, message: 'Missing required argument: guestToken' });
    const typed = await server.request('tools/call', {
      name: 'linejam_submit_line',
      arguments: { guestToken: 't', code: 'ABCD', poemId: 'p', lineIndex: 'zero', text: 'x' },
    });
    expect(typed.error.code).toBe(-32602);
    const extra = await server.request('tools/call', {
      name: 'linejam_room_state',
      arguments: { guestToken: 't', code: 'ABCD', admin: 'yes' },
    });
    expect(extra.error.code).toBe(-32602);
  });

  it('mints guests explicitly and plays a full game with the same rules as the browser', async () => {
    server = new Mcp(url);
    await server.request('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'test', version: '0' },
    });

    // The mint-guest action is the only way to get an identity.
    const ada = (await server.tool('linejam_mint_guest')).data;
    const bea = (await server.tool('linejam_mint_guest')).data;
    expect(ada.guestToken).toMatch(/^[\w-]+\.[\w-]+$/);
    expect(ada.guestId).not.toBe(bea.guestId);

    const created = await server.tool('linejam_create_room', {
      guestToken: ada.guestToken,
      penName: 'Ada',
      emblem: 'prism',
    });
    expect(created.isError).toBe(false);
    const code = created.data.code;
    expect(code).toMatch(/^[2-9A-HJ-NP-Z]{4}$/);

    // A rejected game action is a tool error, not a protocol error and not a success.
    const alone = await server.tool('linejam_start_game', { guestToken: ada.guestToken, code });
    expect(alone.isError).toBe(true);
    expect(alone.data.error).toEqual({ code: 'need_players', message: 'Need 2 players', status: 409 });
    expect(alone.response.error).toBeUndefined();

    const joined = await server.tool('linejam_join_room', { guestToken: bea.guestToken, code, penName: 'Bea' });
    expect(joined.data.members).toHaveLength(2);
    const notHost = await server.tool('linejam_start_game', { guestToken: bea.guestToken, code });
    expect(notHost.isError).toBe(true);
    expect(notHost.data.error.code).toBe('not_host');
    const forged = await server.tool('linejam_room_state', { guestToken: 'forged.token', code });
    expect(forged.isError).toBe(true);
    expect(forged.data.error.code).toBe('guest_invalid');

    expect((await server.tool('linejam_start_game', { guestToken: ada.guestToken, code })).data.phase).toBe('writing');

    const players = [
      ['ada', ada.guestToken],
      ['bea', bea.guestToken],
    ] as const;
    for (let round = 0; round < 9; round++) {
      for (const [who, guestToken] of players) {
        const { assignment } = (await server.tool('linejam_current_assignment', { guestToken, code })).data;
        expect(assignment).toMatchObject({ lineIndex: round, words: WORDS[round] });
        // Only the immediately preceding line is ever visible.
        if (round === 0) expect(assignment.previous).toBeNull();
        else expect(assignment.previous).toMatch(new RegExp(`^(ada|bea)r${round}w1`));
        if (round === 4 && who === 'bea') {
          const wrong = await server.tool('linejam_submit_line', {
            guestToken,
            code,
            poemId: assignment.poemId,
            lineIndex: round,
            text: 'only four words here',
          });
          expect(wrong.isError).toBe(true);
          expect(wrong.data.error).toEqual({ code: 'wrong_word_count', message: 'Use 5 words', status: 422 });
          // Another writer's assignment is refused too.
          const other = (await server.tool('linejam_current_assignment', { guestToken: ada.guestToken, code })).data
            .assignment;
          if (other && other.submitted === null) {
            const steal = await server.tool('linejam_submit_line', {
              guestToken,
              code,
              poemId: other.poemId,
              lineIndex: round,
              text: 'one two three four five',
            });
            expect(steal.isError).toBe(true);
          }
        }
        const text = words(`${who}r${round + 1}w`, WORDS[round]!);
        const sent = await server.tool('linejam_submit_line', {
          guestToken,
          code,
          poemId: assignment.poemId,
          lineIndex: round,
          text,
        });
        expect(sent.isError).toBe(false);
        expect(sent.data).toMatchObject({ text, created: true });
      }
    }

    let state = (await server.tool('linejam_room_state', { guestToken: ada.guestToken, code })).data;
    expect(state.phase).toBe('reading');
    expect(state.game.circle.poems.every((p: { lines: unknown }) => p.lines === null)).toBe(true);
    while (state.game.circle.nextPoemId) {
      const reader = state.game.circle.canReveal ? ada.guestToken : bea.guestToken;
      const revealed = await server.tool('linejam_reveal_poem', {
        guestToken: reader,
        code,
        poemId: state.game.circle.nextPoemId,
      });
      expect(revealed.isError).toBe(false);
      state = (await server.tool('linejam_room_state', { guestToken: ada.guestToken, code })).data;
    }
    expect(state.phase).toBe('complete');

    const poems = (await server.tool('linejam_list_poems', { guestToken: bea.guestToken })).data;
    expect(poems).toHaveLength(2);
    const poem = (await server.tool('linejam_get_poem', { guestToken: bea.guestToken, poemId: poems[0].id })).data;
    expect(poem.lines.map((l: { text: string }) => l.text.split(' ').length)).toEqual(WORDS);
    expect(
      (await server.tool('linejam_toggle_favorite', { guestToken: bea.guestToken, poemId: poems[0].id })).data
    ).toMatchObject({ favorited: true });
    expect((await server.tool('linejam_list_favorites', { guestToken: bea.guestToken })).data).toMatchObject([
      { id: poems[0].id },
    ]);
    expect(
      (await server.tool('linejam_toggle_favorite', { guestToken: bea.guestToken, poemId: poems[0].id })).data
    ).toMatchObject({ favorited: false });

    // Privacy holds for MCP callers exactly as for browsers.
    const eve = (await server.tool('linejam_mint_guest')).data;
    const peek = await server.tool('linejam_get_poem', { guestToken: eve.guestToken, poemId: poems[0].id });
    expect(peek.isError).toBe(true);
    expect(peek.data.error.code).toBe('poem_not_found');
    expect((await server.tool('linejam_list_poems', { guestToken: eve.guestToken })).data).toEqual([]);
  });
});
