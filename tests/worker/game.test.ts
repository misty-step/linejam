import { describe, expect, it } from 'vitest';
import { CODE_ALPHABET, ROUND_WORDS } from '../../shared/rules.ts';
import type { RoomView } from '../../shared/types.ts';
import { call, guest, line, lineTag, party, playGame, playRound, revealAll, start, state } from './helpers.ts';

describe('[L1-2.6] room codes', () => {
  it('issues 4-character codes from the Parlor alphabet only', async () => {
    const host = await guest('Ada');
    for (let i = 0; i < 40; i++) {
      const created = await call<RoomView>('POST', '/api/rooms', {
        token: host.token,
        body: { penName: 'Ada', emblem: 'loom' },
      });
      expect(created.status).toBe(201);
      expect(created.body.code).toHaveLength(4);
      for (const ch of created.body.code) expect(CODE_ALPHABET).toContain(ch);
      expect(created.body.code).not.toMatch(/[01OI]/);
    }
  });

  it('accepts typed codes in lower case with separators', async () => {
    const { code, players } = await party(1);
    const friend = await guest('Bea');
    const typed = `${code.slice(0, 2).toLowerCase()}-${code.slice(2).toLowerCase()}`;
    const joined = await call<RoomView>('POST', `/api/rooms/${typed}/join`, {
      token: friend.token,
      body: { penName: 'Bea', emblem: 'arch' },
    });
    expect(joined.status).toBe(200);
    expect(joined.body.code).toBe(code);
    expect((await state(code, players[0]!)).body.members).toHaveLength(2);
  });

  it('answers an unknown code with a visible error and no phantom seat', async () => {
    const friend = await guest('Bea');
    const joined = await call('POST', '/api/rooms/ZZZZ/join', {
      token: friend.token,
      body: { penName: 'Bea', emblem: 'arch' },
    });
    expect(joined.status).toBe(404);
    expect(joined.body.error).toEqual({ code: 'room_not_found', message: 'Room code not found' });
    expect(
      (await call('POST', '/api/rooms/AB0O/join', { token: friend.token, body: { penName: 'Bea', emblem: 'arch' } }))
        .status
    ).toBe(404);
  });
});

describe('[L1-1] nine-round pass-the-poem loop', () => {
  it('plays 1-2-3-4-5-4-3-2-1 with two writers and completes into the reading circle', async () => {
    const { code, players } = await party(2);
    const view = await playGame(code, players);
    expect(view.phase).toBe('reading');
    expect(view.game!.circle!.poems).toHaveLength(2);
  });

  it('shows no preceding line in round 1 and only the immediately preceding line afterwards', async () => {
    const { code, players } = await party(3);
    await start(code, players[0]!);
    const seen: string[][] = players.map(() => []);
    for (let round = 0; round < ROUND_WORDS.length; round++) {
      for (const [i, player] of players.entries()) {
        const body = (await state(code, player)).body;
        const assignment = body.game!.assignment!;
        expect(assignment.words).toBe(ROUND_WORDS[round]);
        expect(assignment.lineIndex).toBe(round);
        if (round === 0) expect(assignment.previous).toBeNull();
        else {
          // Exactly one line, written last round, by someone else.
          expect(assignment.previous).toMatch(new RegExp(`r${round}w1`));
          expect(assignment.previous).not.toContain(player.name + 'r');
        }
        // The view carries no other poem text anywhere.
        const raw = JSON.stringify(body);
        const lines = raw.match(/Poet\dr\dw\d/g) ?? [];
        for (const found of lines) expect(found).toContain(`r${round}w`);
        seen[i]!.push(assignment.poemId);
      }
      await playRound(code, players, round);
    }
    // Poems pass around: a writer never writes two consecutive lines on one poem.
    for (const poems of seen) for (let r = 1; r < poems.length; r++) expect(poems[r]).not.toBe(poems[r - 1]);
  });

  it.each([2, 3, 5, 8])(
    'assigns every round as a permutation for %i writers and puts every writer on every poem',
    async (count) => {
      const { code, players } = await party(count);
      await start(code, players[0]!);
      const byPoem = new Map<string, Set<string>>();
      for (let round = 0; round < ROUND_WORDS.length; round++) {
        const poems = new Set<string>();
        for (const player of players) {
          const assignment = (await state(code, player)).body.game!.assignment!;
          poems.add(assignment.poemId);
          byPoem.set(assignment.poemId, (byPoem.get(assignment.poemId) ?? new Set()).add(player.name));
        }
        expect(poems.size).toBe(count);
        await playRound(code, players, round);
      }
      expect(byPoem.size).toBe(count);
      for (const writers of byPoem.values()) expect(writers.size).toBe(count);
    }
  );

  it('counts words by whitespace, keeps punctuation attached and collapses pasted whitespace', async () => {
    const { code, players } = await party(2);
    await start(code, players[0]!);
    await playRound(code, players, 0);
    const [a] = players as [(typeof players)[0] & {}];
    const assignment = (await state(code, a)).body.game!.assignment!;
    const submit = (text: string) =>
      call('POST', `/api/rooms/${code}/lines`, {
        token: a.token,
        body: { poemId: assignment.poemId, lineIndex: 1, text },
      });

    const over = await submit('one two three');
    expect(over.status).toBe(422);
    expect(over.body.error).toEqual({ code: 'wrong_word_count', message: 'Use 2 words' });
    expect((await submit('one')).status).toBe(422);
    expect((await submit('   ')).status).toBe(422);
    expect((await state(code, a)).body.game!.assignment!.submitted).toBeNull();

    const accepted = await submit('  well,\t\n  then...  ');
    expect(accepted.status).toBe(200);
    expect(accepted.body).toMatchObject({ text: 'well, then...', created: true });
  });

  it('rejects a line longer than 500 characters with a visible reason', async () => {
    const { code, players } = await party(2);
    await start(code, players[0]!);
    const a = players[0]!;
    const assignment = (await state(code, a)).body.game!.assignment!;
    const reply = await call('POST', `/api/rooms/${code}/lines`, {
      token: a.token,
      body: { poemId: assignment.poemId, lineIndex: 0, text: 'x'.repeat(501) },
    });
    expect(reply.status).toBe(422);
    expect(reply.body.error).toEqual({ code: 'line_too_long', message: 'Use 500 characters or fewer' });
    const ok = await call('POST', `/api/rooms/${code}/lines`, {
      token: a.token,
      body: { poemId: assignment.poemId, lineIndex: 0, text: 'x'.repeat(500) },
    });
    expect(ok.status).toBe(200);
  });

  it("rejects another writer's assignment, a future round and a spectator", async () => {
    const { code, players } = await party(2);
    await start(code, players[0]!);
    const [a, b] = players as [(typeof players)[0], (typeof players)[0]];
    const mine = (await state(code, a)).body.game!.assignment!;
    const theirs = (await state(code, b)).body.game!.assignment!;

    const other = await call('POST', `/api/rooms/${code}/lines`, {
      token: a.token,
      body: { poemId: theirs.poemId, lineIndex: 0, text: 'steal' },
    });
    expect(other.status).toBe(403);
    expect(other.body.error.code).toBe('not_your_assignment');

    const future = await call('POST', `/api/rooms/${code}/lines`, {
      token: a.token,
      body: { poemId: mine.poemId, lineIndex: 1, text: 'too soon' },
    });
    expect(future.status).toBe(409);
    expect(future.body.error.code).toBe('future_round');

    const outsider = await guest('Eve');
    const stranger = await call('POST', `/api/rooms/${code}/lines`, {
      token: outsider.token,
      body: { poemId: mine.poemId, lineIndex: 0, text: 'hello' },
    });
    expect(stranger.status).toBe(403);
    expect(stranger.body.error.code).toBe('not_a_member');
  });

  it('keeps an accepted line immutable: a retry returns the stored line and adds nothing', async () => {
    const { code, players } = await party(2);
    await start(code, players[0]!);
    const a = players[0]!;
    const assignment = (await state(code, a)).body.game!.assignment!;
    const first = await call('POST', `/api/rooms/${code}/lines`, {
      token: a.token,
      body: { poemId: assignment.poemId, lineIndex: 0, text: 'ember' },
    });
    expect(first.body).toMatchObject({ text: 'ember', created: true });
    const retry = await call('POST', `/api/rooms/${code}/lines`, {
      token: a.token,
      body: { poemId: assignment.poemId, lineIndex: 0, text: 'ember' },
    });
    expect(retry.status).toBe(200);
    expect(retry.body).toMatchObject({ text: 'ember', created: false });
    // A stale client with different text settles against the stored text.
    const stale = await call('POST', `/api/rooms/${code}/lines`, {
      token: a.token,
      body: { poemId: assignment.poemId, lineIndex: 0, text: 'different' },
    });
    expect(stale.status).toBe(200);
    expect(stale.body).toMatchObject({ text: 'ember', created: false });
    expect((await state(code, a)).body.game!.assignment!.submitted).toBe('ember');
  });

  it('retries of the final round 9 line are idempotent and never add a tenth line', async () => {
    const { code, players } = await party(2);
    await start(code, players[0]!);
    for (let round = 0; round < 8; round++) await playRound(code, players, round);
    const [a, b] = players as [(typeof players)[0], (typeof players)[0]];
    const last = (await state(code, a)).body.game!.assignment!;
    expect(last.lineIndex).toBe(8);
    const body = { poemId: last.poemId, lineIndex: 8, text: 'fin' };
    const first = await call('POST', `/api/rooms/${code}/lines`, { token: a.token, body });
    expect(first.body).toMatchObject({ text: 'fin', created: true });
    // Retry while the round is still open…
    expect((await call('POST', `/api/rooms/${code}/lines`, { token: a.token, body })).body).toMatchObject({
      text: 'fin',
      created: false,
    });
    const lastB = (await state(code, b)).body.game!.assignment!;
    const done = await call('POST', `/api/rooms/${code}/lines`, {
      token: b.token,
      body: { poemId: lastB.poemId, lineIndex: 8, text: 'end' },
    });
    expect(done.body.created).toBe(true);
    expect((await state(code, a)).body.phase).toBe('reading');
    // …and again after the game completed, with the same and with different text.
    for (const text of ['fin', 'rewritten']) {
      const retry = await call('POST', `/api/rooms/${code}/lines`, { token: a.token, body: { ...body, text } });
      expect(retry.status).toBe(200);
      expect(retry.body).toMatchObject({ text: 'fin', created: false });
    }
    const revealed = await revealAll(code, players);
    expect(revealed.phase).toBe('complete');
    for (const poem of revealed.game!.circle!.poems) {
      expect(poem.lines).toHaveLength(9);
      expect(poem.lines!.map((l) => l.text.split(' ').length)).toEqual([...ROUND_WORDS]);
    }
    const archive = await call('GET', '/api/poems', { token: a.token });
    expect(archive.body).toHaveLength(2);
  });

  it('advances only when every assigned line is accepted and never fabricates a line', async () => {
    const { code, players } = await party(3);
    await start(code, players[0]!);
    const [a, b, c] = players as [(typeof players)[0], (typeof players)[0], (typeof players)[0]];
    for (const p of [a, b]) {
      const assignment = (await state(code, p)).body.game!.assignment!;
      await call('POST', `/api/rooms/${code}/lines`, {
        token: p.token,
        body: { poemId: assignment.poemId, lineIndex: 0, text: line(lineTag(p, 0), 1) },
      });
    }
    const waiting = (await state(code, a)).body;
    expect(waiting.game!.round).toBe(0);
    expect(waiting.game!.writers.filter((w) => w.submitted)).toHaveLength(2);
    // Who has submitted is visible; what they wrote is not.
    expect(JSON.stringify(waiting)).not.toContain(lineTag(b, 0));
    // Writers are listed in seat order, not by submission speed.
    expect(waiting.game!.writers.map((w) => w.seat)).toEqual([0, 1, 2]);
    const assignment = (await state(code, c)).body.game!.assignment!;
    await call('POST', `/api/rooms/${code}/lines`, {
      token: c.token,
      body: { poemId: assignment.poemId, lineIndex: 0, text: 'third' },
    });
    expect((await state(code, a)).body.game!.round).toBe(1);
  });
});
