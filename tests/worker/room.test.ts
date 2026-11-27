import { evictDurableObject, runDurableObjectAlarm } from 'cloudflare:test';
import { exports } from 'cloudflare:workers';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ROUND_WORDS } from '../../shared/rules.ts';
import type { RoomView } from '../../shared/types.ts';
import { GRACE_MS, LEASE_MS } from '../../src/room.ts';
import { ORIGIN, bindings, call, guest, party, playGame, playRound, revealAll, start, state, type Player } from './helpers.ts';

afterEach(() => {
  vi.useRealTimers();
});

const roomStub = (code: string) => bindings.ROOM.get(bindings.ROOM.idFromName(code));

/** Move the clock and let the room's alarm settle presence, as it would in production. */
async function advance(code: string, ms: number): Promise<void> {
  vi.setSystemTime(Date.now() + ms);
  await runDurableObjectAlarm(roomStub(code));
}

async function socket(code: string, player: Player): Promise<{ ws: WebSocket; messages: RoomView[] }> {
  const worker = (exports as unknown as { default: { fetch(request: Request): Promise<Response> } }).default;
  const response = await worker.fetch(
    new Request(`${ORIGIN}/api/rooms/${code}/ws`, { headers: { upgrade: 'websocket', authorization: `Bearer ${player.token}` } })
  );
  expect(response.status).toBe(101);
  const ws = response.webSocket!;
  const messages: RoomView[] = [];
  ws.addEventListener('message', (event) => {
    if (event.data === 'pong') return;
    const parsed = JSON.parse(event.data as string);
    if (parsed.type === 'state') messages.push(parsed.state);
  });
  ws.accept();
  return { ws, messages };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

describe('[L1-2.1] entry', () => {
  it('trims pen names, refuses blank ones and unknown emblems', async () => {
    const host = await guest();
    const blank = await call('POST', '/api/rooms', { token: host.token, body: { penName: '   ', emblem: 'loom' } });
    expect(blank.status).toBe(422);
    expect(blank.body.error).toEqual({ code: 'pen_name_required', message: 'Enter a pen name' });
    const emblem = await call('POST', '/api/rooms', { token: host.token, body: { penName: 'Ada', emblem: 'dragon' } });
    expect(emblem.status).toBe(422);
    expect(emblem.body.error.code).toBe('invalid_emblem');
    const created = await call<RoomView>('POST', '/api/rooms', { token: host.token, body: { penName: '  Ada   Lovelace ', emblem: 'orrery' } });
    expect(created.status).toBe(201);
    expect(created.body.you).toMatchObject({ penName: 'Ada Lovelace', emblem: 'orrery', isHost: true });
    expect(created.body.phase).toBe('lobby');
  });

  it('allows duplicate emblems and marks the host distinctly in the roster', async () => {
    const { code, players } = await party(1);
    const friend = await guest('Bea');
    await call('POST', `/api/rooms/${code}/join`, { token: friend.token, body: { penName: 'Bea', emblem: 'loom' } });
    const view = (await state(code, players[0]!)).body;
    expect(view.members.map((m) => [m.penName, m.emblem, m.isHost, m.isYou])).toEqual([
      ['Poet1', 'loom', true, true],
      ['Bea', 'loom', false, false],
    ]);
  });

  it('requires a guest credential and never exposes guest ids in a room view', async () => {
    expect((await call('POST', '/api/rooms', { body: { penName: 'Ada', emblem: 'loom' } })).status).toBe(401);
    const { code, players } = await party(2);
    const raw = JSON.stringify((await state(code, players[0]!)).body);
    for (const player of players) expect(raw).not.toContain(player.guestId);
  });
});

describe('[L1-2.9] capacity and seats', () => {
  it('seats 8, refuses the ninth with a visible error, and reuses a seat on rejoin', async () => {
    const { code, players } = await party(8);
    expect((await state(code, players[0]!)).body.members).toHaveLength(8);
    const ninth = await guest('Ninth');
    const refused = await call('POST', `/api/rooms/${code}/join`, { token: ninth.token, body: { penName: 'Ninth', emblem: 'arch' } });
    expect(refused.status).toBe(409);
    expect(refused.body.error).toEqual({ code: 'room_full', message: 'Room is full' });
    expect((await state(code, ninth)).status).toBe(403);

    const again = await call<RoomView>('POST', `/api/rooms/${code}/join`, {
      token: players[3]!.token,
      body: { penName: 'Renamed', emblem: 'prism' },
    });
    expect(again.status).toBe(200);
    expect(again.body.members).toHaveLength(8);
    expect(again.body.you).toMatchObject({ seat: 3, penName: 'Renamed' });
  });

  it('treats a different session with the same pen name as a different guest', async () => {
    const { code } = await party(1);
    const twin = await guest('Poet1');
    const joined = await call<RoomView>('POST', `/api/rooms/${code}/join`, { token: twin.token, body: { penName: 'Poet1', emblem: 'loom' } });
    expect(joined.body.members).toHaveLength(2);
    expect(joined.body.you.isHost).toBe(false);
  });
});

describe('[L1-2.10] [L1-2.11] starting', () => {
  it('needs two present players; only the host can start', async () => {
    const { code, players } = await party(1);
    const alone = (await state(code, players[0]!)).body;
    expect(alone.startBlocker).toBe('need_players');
    const refused = await start(code, players[0]!);
    expect(refused.status).toBe(409);
    expect(refused.body).toMatchObject({ error: { code: 'need_players', message: 'Need 2 players' } });

    const friend = await guest('Bea');
    const joined = await call<RoomView>('POST', `/api/rooms/${code}/join`, { token: friend.token, body: { penName: 'Bea', emblem: 'arch' } });
    expect(joined.body.startBlocker).toBe('not_host');
    expect((await start(code, friend)).status).toBe(403);
    expect((await state(code, players[0]!)).body.startBlocker).toBeNull();
    expect((await start(code, players[0]!)).status).toBe(200);
  });

  it('never creates overlapping games from concurrent start attempts', async () => {
    const { code, players } = await party(3);
    const results = await Promise.all([start(code, players[0]!), start(code, players[0]!), start(code, players[0]!)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409, 409]);
    expect(results.find((r) => r.status === 409)!.body).toMatchObject({ error: { code: 'game_active' } });
    const views = await Promise.all(players.map((p) => state(code, p)));
    expect(new Set(views.map((v) => v.body.game!.id)).size).toBe(1);
    expect(views[0]!.body.game!.cycle).toBe(1);
  });
});

describe('[L1-2.12] late arrivals are spectators', () => {
  it('joins an active game without an assignment, without blocking progress, and without hidden text', async () => {
    const { code, players } = await party(2);
    await start(code, players[0]!);
    await playRound(code, players, 0);

    const late = await guest('Late');
    const joined = await call<RoomView>('POST', `/api/rooms/${code}/join`, { token: late.token, body: { penName: 'Late', emblem: 'vesper' } });
    expect(joined.status).toBe(200);
    expect(joined.body.game).toMatchObject({ role: 'spectator', assignment: null, circle: null });
    expect(joined.body.game!.writers).toHaveLength(2);
    expect(JSON.stringify(joined.body)).not.toMatch(/Poet\dr\d/);

    const assignment = await call('GET', `/api/rooms/${code}/assignment`, { token: late.token });
    expect(assignment.body.assignment).toBeNull();
    const target = (await state(code, players[0]!)).body.game!.assignment!;
    const submit = await call('POST', `/api/rooms/${code}/lines`, { token: late.token, body: { poemId: target.poemId, lineIndex: 1, text: 'sneak in' } });
    expect(submit.status).toBe(403);
    expect(submit.body.error.code).toBe('not_a_writer');

    // The two writers finish without the spectator.
    for (let round = 1; round < ROUND_WORDS.length; round++) {
      await playRound(code, players, round);
      expect(JSON.stringify((await state(code, late)).body)).not.toMatch(/Poet\dr\d/);
    }
    const reading = (await state(code, late)).body;
    expect(reading.phase).toBe('reading');
    expect(reading.game!.circle!.canReveal).toBe(false);
    expect(reading.game!.circle!.poems.every((p) => p.lines === null)).toBe(true);
    const reveal = await call('POST', `/api/rooms/${code}/reveal`, { token: late.token, body: { poemId: reading.game!.circle!.nextPoemId } });
    expect(reveal.status).toBe(403);
    // No archive, no private read, no heart, no share for a spectator.
    expect((await call('GET', '/api/poems', { token: late.token })).body).toEqual([]);
    const poemId = reading.game!.circle!.poems[0]!.id;
    expect((await call('GET', `/api/poems/${poemId}`, { token: late.token })).status).toBe(404);
    expect((await call('POST', `/api/poems/${poemId}/favorite`, { token: late.token, body: { on: true } })).status).toBe(404);
    expect((await call('POST', `/api/poems/${poemId}/share`, { token: late.token })).status).toBe(404);

    // After reveal, the room (spectators included) sees exactly the revealed poem.
    await revealAll(code, players);
    const after = (await state(code, late)).body;
    expect(after.game!.circle!.poems.every((p) => p.lines?.length === 9)).toBe(true);

    // They write normally in the next game.
    const again = await start(code, players[0]!);
    expect(again.status).toBe(200);
    expect((await state(code, late)).body.game).toMatchObject({ role: 'writer', cycle: 2 });
    expect((await state(code, late)).body.game!.writers).toHaveLength(3);
  });
});

describe('[L1-2.13] [L1-2.14] presence and host succession', () => {
  it('distinguishes present, reconnecting and away, and never adds a seat on reconnect', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const { code, players } = await party(2);
    const [host, friend] = players as [Player, Player];
    const a = await socket(code, host);
    const b = await socket(code, friend);
    await settle();
    expect(a.messages.at(-1)!.members.map((m) => m.presence)).toEqual(['present', 'present']);

    b.ws.close(1000, 'bye');
    await settle();
    expect(a.messages.at(-1)!.members.map((m) => m.presence)).toEqual(['present', 'reconnecting']);

    // Back within the grace period: the same seat, no duplicate.
    const b2 = await socket(code, friend);
    await settle();
    expect(a.messages.at(-1)!.members.map((m) => [m.seat, m.presence])).toEqual([
      [0, 'present'],
      [1, 'present'],
    ]);

    b2.ws.close(1000, 'bye');
    await settle();
    await advance(code, GRACE_MS + 1);
    await settle();
    expect(a.messages.at(-1)!.members.map((m) => m.presence)).toEqual(['present', 'away']);
    expect(a.messages.at(-1)!.startBlocker).toBe('need_players');
    a.ws.close(1000, 'done');
  });

  it('passes host authority to a present player when the host is away, and refreshing does not take it back', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const { code, players } = await party(3);
    const [host, second, third] = players as [Player, Player, Player];
    const h = await socket(code, host);
    const s = await socket(code, second);
    const t = await socket(code, third);
    await settle();

    // A refresh (drop and return inside the grace period) keeps authority.
    h.ws.close(1000, 'refresh');
    await settle();
    await advance(code, 2_000);
    const h2 = await socket(code, host);
    await settle();
    expect(s.messages.at(-1)!.members.find((m) => m.isHost)!.penName).toBe('Poet1');

    // Gone past the grace period: the longest-seated present player becomes host.
    h2.ws.close(1000, 'gone');
    await settle();
    await advance(code, GRACE_MS + 1);
    await settle();
    const after = s.messages.at(-1)!;
    expect(after.members.find((m) => m.isHost)!.penName).toBe('Poet2');
    expect(after.you.isHost).toBe(true);
    expect(after.members[0]!.presence).toBe('away');

    // The former host returns and refreshes: a writer again, not the host.
    const h3 = await socket(code, host);
    await settle();
    expect(h3.messages.at(-1)!.you.isHost).toBe(false);
    h3.ws.close(1000, 'refresh');
    await settle();
    const h4 = await socket(code, host);
    await settle();
    expect(h4.messages.at(-1)!.you.isHost).toBe(false);
    expect(h4.messages.at(-1)!.members.find((m) => m.isHost)!.penName).toBe('Poet2');
    expect((await start(code, host)).status).toBe(403);
    expect((await start(code, second)).status).toBe(200);
    for (const { ws } of [s, t, h4]) ws.close(1000, 'done');
  });

  it('keeps an HTTP-only player present for the lease after each call, then reconnecting, then away', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const { code, players } = await party(2);
    const [host, friend] = players as [Player, Player];
    const presenceOf = async () => (await state(code, host)).body.members[1]!.presence;
    expect(await presenceOf()).toBe('present');
    vi.setSystemTime(Date.now() + LEASE_MS + 1);
    expect(await presenceOf()).toBe('reconnecting');
    vi.setSystemTime(Date.now() + GRACE_MS + 1);
    expect(await presenceOf()).toBe('away');
    // Any authenticated call renews it — the HTTP fallback's poll is the heartbeat.
    await state(code, friend);
    expect(await presenceOf()).toBe('present');
  });
});

describe('[L1-5.2] real-time over hibernating WebSockets, with an HTTP fallback', () => {
  it('pushes every change to every socket, each with its own limited view', async () => {
    const { code, players } = await party(2);
    const [host, friend] = players as [Player, Player];
    const a = await socket(code, host);
    const b = await socket(code, friend);
    await settle();
    await start(code, host);
    await settle();
    const va = a.messages.at(-1)!;
    const vb = b.messages.at(-1)!;
    expect(va.phase).toBe('writing');
    expect(va.game!.assignment!.poemId).not.toBe(vb.game!.assignment!.poemId);
    await call('POST', `/api/rooms/${code}/lines`, { token: host.token, body: { poemId: va.game!.assignment!.poemId, lineIndex: 0, text: 'secret' } });
    await settle();
    const pushed = b.messages.at(-1)!;
    expect(pushed.game!.writers.find((w) => !w.isYou)!.submitted).toBe(true);
    expect(JSON.stringify(pushed)).not.toContain('secret');
    a.ws.close(1000, 'done');
    b.ws.close(1000, 'done');
  });

  it('keeps sockets across hibernation: an evicted object still broadcasts', async () => {
    const { code, players } = await party(2);
    const [host, friend] = players as [Player, Player];
    const b = await socket(code, friend);
    await settle();
    await evictDurableObject(roomStub(code));
    const before = b.messages.length;
    expect((await start(code, host)).status).toBe(200);
    await settle();
    expect(b.messages.length).toBeGreaterThan(before);
    expect(b.messages.at(-1)!.phase).toBe('writing');
    expect(b.messages.at(-1)!.members.map((m) => m.presence)).toEqual(['present', 'present']);
    b.ws.close(1000, 'done');
  });

  it('refuses a socket for a non-member and answers ping without waking game logic', async () => {
    const { code, players } = await party(1);
    const outsider = await guest('Eve');
    const worker = (exports as unknown as { default: { fetch(request: Request): Promise<Response> } }).default;
    const refused = await worker.fetch(
      new Request(`${ORIGIN}/api/rooms/${code}/ws`, { headers: { upgrade: 'websocket', authorization: `Bearer ${outsider.token}` } })
    );
    expect(refused.status).toBe(403);
    const a = await socket(code, players[0]!);
    const pong = new Promise<string>((resolve) => a.ws.addEventListener('message', (e) => e.data === 'pong' && resolve('pong')));
    a.ws.send('ping');
    expect(await pong).toBe('pong');
    a.ws.close(1000, 'done');
  });

  it('serves the HTTP fallback: 204 while unchanged, the new view after a change', async () => {
    const { code, players } = await party(2);
    const [host, friend] = players as [Player, Player];
    const first = (await state(code, friend)).body;
    const unchanged = await call('GET', `/api/rooms/${code}?v=${first.version}`, { token: friend.token });
    expect(unchanged.status).toBe(204);
    await start(code, host);
    const changed = await call<RoomView>('GET', `/api/rooms/${code}?v=${first.version}`, { token: friend.token });
    expect(changed.status).toBe(200);
    expect(changed.body.phase).toBe('writing');
    expect(changed.body.version).toBeGreaterThan(first.version);
  });
});

describe('[L1-3.5] [L1-3.7] reading circle', () => {
  it('marks reading now / up next / read, reveals in order, and lets a reveal repeat harmlessly', async () => {
    const { code, players } = await party(3);
    const view = await playGame(code, players);
    const circle = view.game!.circle!;
    expect(circle.poems.map((p) => p.state)).toEqual(['next', 'waiting', 'waiting']);
    expect(circle.poems.every((p) => p.lines === null)).toBe(true);
    expect(circle.nextReaderName).toBe(circle.poems[0]!.readerName);

    // Out of order is refused.
    const views = await Promise.all(players.map((p) => state(code, p)));
    const readerOf = (poemId: string) => players[views.findIndex((v) => v.body.game!.circle!.poems.find((p) => p.id === poemId)!.readerIsYou)]!;
    const second = circle.poems[1]!;
    const early = await call('POST', `/api/rooms/${code}/reveal`, { token: readerOf(second.id).token, body: { poemId: second.id } });
    expect(early.status).toBe(409);
    expect(early.body.error.code).toBe('not_next');

    const first = circle.poems[0]!;
    const one = await call<RoomView>('POST', `/api/rooms/${code}/reveal`, { token: readerOf(first.id).token, body: { poemId: first.id } });
    expect(one.status).toBe(200);
    expect(one.body.game!.circle!.poems.map((p) => p.state)).toEqual(['reading', 'next', 'waiting']);
    const lines = one.body.game!.circle!.poems[0]!.lines!;
    expect(lines).toHaveLength(9);
    expect(lines.map((l) => l.text.split(' ').length)).toEqual([...ROUND_WORDS]);
    // Write-time bylines on every line; the text is each writer's own.
    for (const l of lines) expect(l.text.startsWith(`${l.by}r`)).toBe(true);

    const repeat = await call<RoomView>('POST', `/api/rooms/${code}/reveal`, { token: readerOf(first.id).token, body: { poemId: first.id } });
    expect(repeat.status).toBe(200);
    expect(repeat.body.game!.circle!.poems.map((p) => p.state)).toEqual(['reading', 'next', 'waiting']);

    const done = await revealAll(code, players);
    expect(done.phase).toBe('complete');
    expect(done.game!.circle!.poems.map((p) => p.state)).toEqual(['read', 'read', 'reading']);
    expect(done.game!.circle!.nextPoemId).toBeNull();
  });

  it('gives the assigned reader authority while present and lets a participant step in when they are absent', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const { code, players } = await party(3);
    await playGame(code, players);
    const views = await Promise.all(players.map((p) => state(code, p)));
    const next = views[0]!.body.game!.circle!.nextPoemId!;
    const readerIndex = views.findIndex((v) => v.body.game!.circle!.poems.find((p) => p.id === next)!.readerIsYou);
    const other = players[(readerIndex + 1) % 3]!;
    expect(views[(readerIndex + 1) % 3]!.body.game!.circle!.canReveal).toBe(false);
    const refused = await call('POST', `/api/rooms/${code}/reveal`, { token: other.token, body: { poemId: next } });
    expect(refused.status).toBe(403);
    expect(refused.body.error.code).toBe('reader_present');

    // The reader goes away; a present participant steps in.
    vi.setSystemTime(Date.now() + LEASE_MS + GRACE_MS + 1);
    const stepIn = await state(code, other);
    expect(stepIn.body.game!.circle!.canReveal).toBe(true);
    const revealed = await call('POST', `/api/rooms/${code}/reveal`, { token: other.token, body: { poemId: next } });
    expect(revealed.status).toBe(200);
  });

  it('highlights the most-hearted poem at the recap, ties by poem order, nothing with no hearts', async () => {
    const { code, players } = await party(3);
    await playGame(code, players);
    const done = await revealAll(code, players);
    expect(done.game!.circle!.mostHeartedPoemId).toBeNull();
    const [p0, p1, p2] = done.game!.circle!.poems as [any, any, any];
    await call('POST', `/api/poems/${p2.id}/favorite`, { token: players[0]!.token, body: { on: true } });
    await call('POST', `/api/poems/${p1.id}/favorite`, { token: players[1]!.token, body: { on: true } });
    let view = (await state(code, players[0]!)).body;
    expect(view.game!.circle!.mostHeartedPoemId).toBe(p1.id);
    expect(view.game!.circle!.poems.map((p) => [p.hearts, p.hearted])).toEqual([[0, false], [1, false], [1, true]]);
    await call('POST', `/api/poems/${p2.id}/favorite`, { token: players[1]!.token, body: { on: true } });
    view = (await state(code, players[0]!)).body;
    expect(view.game!.circle!.mostHeartedPoemId).toBe(p2.id);
    expect(p0.hearts).toBe(0);
  });
});

describe('[L1-2.15] [L1-3.8] ending, replaying and closing', () => {
  it('lets only the host end a stalled game: back to the lobby, nothing archived, old lines refused', async () => {
    const { code, players } = await party(2);
    await start(code, players[0]!);
    await playRound(code, players, 0);
    const assignment = (await state(code, players[1]!)).body.game!.assignment!;
    expect((await call('POST', `/api/rooms/${code}/end`, { token: players[1]!.token })).status).toBe(403);
    const ended = await call<RoomView>('POST', `/api/rooms/${code}/end`, { token: players[0]!.token });
    expect(ended.status).toBe(200);
    expect(ended.body).toMatchObject({ phase: 'lobby', game: null });
    const late = await call('POST', `/api/rooms/${code}/lines`, { token: players[1]!.token, body: { poemId: assignment.poemId, lineIndex: 1, text: 'too late' } });
    expect(late.status).toBe(409);
    expect(late.body.error.code).toBe('game_ended');
    for (const p of players) expect((await call('GET', '/api/poems', { token: p.token })).body).toEqual([]);
    // The room hosts another game; the ended one never returns.
    const next = await playGame(code, players);
    expect(next.game!.cycle).toBe(2);
    await revealAll(code, players);
    expect((await call('GET', '/api/poems', { token: players[0]!.token })).body).toHaveLength(2);
  });

  it('plays again without overwriting earlier poems, and returns to the lobby on request', async () => {
    const { code, players } = await party(2);
    await playGame(code, players);
    const blocked = await call('POST', `/api/rooms/${code}/lobby`, { token: players[0]!.token });
    expect(blocked.status).toBe(409);
    const first = await revealAll(code, players);
    const again = await start(code, players[0]!);
    expect(again.status).toBe(200);
    expect(again.body.game).toMatchObject({ cycle: 2, status: 'writing' });
    for (let round = 0; round < ROUND_WORDS.length; round++) await playRound(code, players, round);
    await revealAll(code, players);
    const archive = (await call('GET', '/api/poems', { token: players[0]!.token })).body as { id: string }[];
    expect(archive).toHaveLength(4);
    for (const poem of first.game!.circle!.poems) expect(archive.map((p) => p.id)).toContain(poem.id);
    const lobby = await call<RoomView>('POST', `/api/rooms/${code}/lobby`, { token: players[0]!.token });
    expect(lobby.body).toMatchObject({ phase: 'lobby', game: null });
  });

  it('refuses to close during a game, closes an idle room for the host only, and rejects new arrivals afterwards', async () => {
    const { code, players } = await party(2);
    await start(code, players[0]!);
    const during = await call('POST', `/api/rooms/${code}/close`, { token: players[0]!.token });
    expect(during.status).toBe(409);
    expect(during.body.error.code).toBe('game_active');
    await call('POST', `/api/rooms/${code}/end`, { token: players[0]!.token });
    expect((await call('POST', `/api/rooms/${code}/close`, { token: players[1]!.token })).status).toBe(403);
    expect((await call('POST', `/api/rooms/${code}/close`, { token: players[0]!.token })).status).toBe(200);
    const arrival = await guest('New');
    const refused = await call('POST', `/api/rooms/${code}/join`, { token: arrival.token, body: { penName: 'New', emblem: 'arch' } });
    expect(refused.status).toBe(410);
    expect(refused.body.error).toEqual({ code: 'room_closed', message: 'Room is closed' });
    expect((await state(code, players[1]!)).body.phase).toBe('closed');
  });

  it('frees the seat when a player leaves the lobby', async () => {
    const { code, players } = await party(3);
    expect((await call('POST', `/api/rooms/${code}/leave`, { token: players[2]!.token })).status).toBe(200);
    expect((await state(code, players[0]!)).body.members).toHaveLength(2);
    expect((await state(code, players[2]!)).status).toBe(403);
  });
});
