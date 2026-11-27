import { describe, expect, inject, it } from 'vitest';
import { WORDS, cli, stderrJson, words } from './helpers.ts';

const url = inject('linejamUrl');

describe('[L1-6] CLI parity', () => {
  it('prints help without a target or an identity', async () => {
    const help = await cli('', ['--help']);
    expect(help.code).toBe(0);
    expect(help.stdout).toContain('room create <penName>');
  });

  it('plays a whole two-player game through the same HTTP API as the browser', async () => {
    // room create mints a guest: the credential is on stderr, never on stdout.
    const created = await cli(url, ['room', 'create', 'Ada', '--emblem', 'orrery']);
    expect(created.code).toBe(0);
    const room = JSON.parse(created.stdout);
    const [{ minted: host }] = stderrJson(created);
    expect(host.guestToken).toMatch(/^[\w-]+\.[\w-]+$/);
    expect(created.stdout).not.toContain(host.guestToken);
    expect(room.code).toMatch(/^[2-9A-HJ-NP-Z]{4}$/);
    expect(room.you).toMatchObject({ penName: 'Ada', emblem: 'orrery', isHost: true });

    const joined = await cli(url, ['room', 'join', room.code.toLowerCase(), 'Bea']);
    expect(joined.code).toBe(0);
    const [{ minted: guest }] = stderrJson(joined);
    expect(joined.stdout).not.toContain(guest.guestToken);
    expect(JSON.parse(joined.stdout).members).toHaveLength(2);

    // Later commands reuse the identity: by flag or by environment.
    const asHost = ['--guest-token', host.guestToken];
    const asGuest = { LINEJAM_GUEST_TOKEN: guest.guestToken };

    // No privileged shortcut: a non-host cannot start.
    const refusedStart = await cli(url, ['game', 'start', room.code], asGuest);
    expect(refusedStart.code).toBe(1);
    expect(refusedStart.stdout).toBe('');
    expect(stderrJson(refusedStart)[0].error).toMatchObject({ code: 'not_host', status: 403 });

    const started = await cli(url, ['game', 'start', room.code, ...asHost]);
    expect(started.code).toBe(0);
    expect(JSON.parse(started.stdout).phase).toBe('writing');

    for (let round = 0; round < 9; round++) {
      for (const [who, flags, env] of [
        ['ada', asHost, {}],
        ['bea', [], asGuest],
      ] as const) {
        const got = await cli(url, ['game', 'assignment', room.code, ...flags], env);
        expect(got.code).toBe(0);
        const { assignment } = JSON.parse(got.stdout);
        expect(assignment).toMatchObject({ lineIndex: round, words: WORDS[round] });
        if (round === 0) expect(assignment.previous).toBeNull();
        else expect(assignment.previous).toMatch(new RegExp(`^(ada|bea)r${round}w1`));

        if (round === 3 && who === 'ada') {
          // The same word-count rule as the browser, with the same visible reason.
          const wrong = await cli(
            url,
            ['game', 'submit-line', room.code, assignment.poemId, String(round), 'far too many words here', ...flags],
            env
          );
          expect(wrong.code).toBe(1);
          expect(wrong.stdout).toBe('');
          expect(stderrJson(wrong)[0].error).toEqual({ code: 'wrong_word_count', message: 'Use 4 words', status: 422 });
        }
        const text = words(`${who}r${round + 1}w`, WORDS[round]!);
        const sent = await cli(
          url,
          ['game', 'submit-line', room.code, assignment.poemId, String(round), ...text.split(' '), ...flags],
          env
        );
        expect(sent.code).toBe(0);
        expect(JSON.parse(sent.stdout)).toMatchObject({ text, created: true });
        if (round === 8) {
          // A retry of the final line is idempotent.
          const retry = await cli(
            url,
            ['game', 'submit-line', room.code, assignment.poemId, '8', 'changed', ...flags],
            env
          );
          expect(JSON.parse(retry.stdout)).toMatchObject({ text, created: false });
        }
      }
    }

    // Reading circle: each poem revealed by whoever may reveal it.
    for (let i = 0; i < 2; i++) {
      const view = JSON.parse((await cli(url, ['room', 'state', room.code, ...asHost])).stdout);
      const circle = view.game.circle;
      const reveal = circle.canReveal
        ? await cli(url, ['game', 'reveal', room.code, circle.nextPoemId, ...asHost])
        : await cli(url, ['game', 'reveal', room.code, circle.nextPoemId], asGuest);
      expect(reveal.code).toBe(0);
    }
    const done = JSON.parse((await cli(url, ['room', 'state', room.code], asGuest)).stdout);
    expect(done.phase).toBe('complete');

    // Completed-poem reads and favorites.
    const list = JSON.parse((await cli(url, ['poems', 'list', ...asHost])).stdout);
    expect(list).toHaveLength(2);
    const poem = JSON.parse((await cli(url, ['poems', 'get', list[0].id], asGuest)).stdout);
    expect(poem.lines).toHaveLength(9);
    expect(poem.lines.map((l: { text: string }) => l.text.split(' ').length)).toEqual(WORDS);
    const toggled = JSON.parse((await cli(url, ['favorites', 'toggle', list[1].id, ...asHost])).stdout);
    expect(toggled).toMatchObject({ favorited: true, hearts: 1 });
    const favorites = JSON.parse((await cli(url, ['favorites', 'list', ...asHost])).stdout);
    expect(favorites).toMatchObject([{ id: list[1].id, available: true }]);
    expect(JSON.parse((await cli(url, ['poems', 'list', ...asHost])).stdout)[0]).toMatchObject({
      id: list[1].id,
      favorited: true,
    });

    // The same privacy rule: a different guest cannot read the poem.
    const stranger = stderrJson(await cli(url, ['guest', 'mint']))[0].minted;
    const peek = await cli(url, ['poems', 'get', list[0].id, '--guest-token', stranger.guestToken]);
    expect(peek.code).toBe(1);
    expect(peek.stdout).toBe('');
    expect(stderrJson(peek)[0].error).toMatchObject({ code: 'poem_not_found', status: 404 });
  });

  it('reports a rejected join as a structured failure: stderr, empty stdout, nonzero exit', async () => {
    const result = await cli(url, ['room', 'join', 'ZZZZ', 'Nobody']);
    expect(result.code).toBe(1);
    expect(result.stdout).toBe('');
    const lines = stderrJson(result);
    expect(lines.at(-1).error).toEqual({ code: 'room_not_found', message: 'Room code not found', status: 404 });
  });

  it('keeps `guest mint` output shareable: the credential is on stderr only', async () => {
    const minted = await cli(url, ['guest', 'mint']);
    expect(minted.code).toBe(0);
    const { guestId } = JSON.parse(minted.stdout);
    const [{ minted: credential }] = stderrJson(minted);
    expect(credential.guestId).toBe(guestId);
    expect(minted.stdout).not.toContain(credential.guestToken);
  });

  it('refuses commands that need an identity or arguments, as usage errors', async () => {
    const noToken = await cli(url, ['room', 'state', 'ABCD']);
    expect(noToken.code).toBe(2);
    expect(noToken.stdout).toBe('');
    expect(stderrJson(noToken)[0].error.code).toBe('usage');
    expect((await cli(url, ['game', 'frobnicate'])).code).toBe(2);
    expect((await cli(url, ['room', 'create', 'Ada', '--emblem', 'dragon'])).code).toBe(2);
    const forged = await cli(url, ['poems', 'list', '--guest-token', 'not.a-token']);
    expect(forged.code).toBe(1);
    expect(stderrJson(forged)[0].error).toMatchObject({ code: 'guest_invalid', status: 401 });
  });
});
