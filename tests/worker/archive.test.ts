import { reset, runDurableObjectAlarm, runInDurableObject } from 'cloudflare:test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ArchiveEntry, FavoriteEntry, PoemView, RecapView, ShareAttempt } from '../../shared/types.ts';
import { PRIVATE_RETENTION_MS, PROTECTION_GRACE_MS, SHARE_PENDING_MS, type ArchiveDO } from '../../src/archive.ts';
import { signGuestToken } from '../../src/auth.ts';
import { ABANDONED_RETENTION_MS } from '../../src/room.ts';
import { bindings, call, guest, party, playGame, playRound, revealAll, start, state, type Player } from './helpers.ts';

afterEach(async () => {
  vi.useRealTimers();
  // The archive is one object; start every test from empty storage.
  await reset();
});

/** A guest credential lasts 7 days; a player who comes back months later holds a renewed one. */
async function renewed(player: Player): Promise<Player> {
  return {
    ...player,
    token: await signGuestToken('local-test-guest-secret-0123456789abcdef', player.guestId, Date.now()),
  };
}

const archiveStub = () => bindings.ARCHIVE.get(bindings.ARCHIVE.idFromName('archive'));
const DAY = 24 * 60 * 60 * 1000;

async function finished(count = 2): Promise<{ code: string; players: Player[]; poemIds: string[]; gameId: string }> {
  const { code, players } = await party(count);
  await playGame(code, players);
  const view = await revealAll(code, players);
  return { code, players, poemIds: view.game!.circle!.poems.map((p) => p.id), gameId: view.game!.id };
}

async function publish(player: Player, poemId: string): Promise<ShareAttempt> {
  const attempt = await call<ShareAttempt>('POST', `/api/poems/${poemId}/share`, { token: player.token });
  expect(attempt.status).toBe(201);
  const confirmed = await call<ShareAttempt>('POST', `/api/poems/${poemId}/share/confirm`, {
    token: player.token,
    body: { token: attempt.body.token },
  });
  expect(confirmed.status).toBe(200);
  expect(confirmed.body.active).toBe(true);
  return confirmed.body;
}

describe('[L1-4.1] [L1-4.2] private archive', () => {
  it('lists completed poems for their participants only, favorites first then newest', async () => {
    const { players, poemIds } = await finished(2);
    const outsider = await guest('Eve');
    const mine = (await call<ArchiveEntry[]>('GET', '/api/poems', { token: players[0]!.token })).body;
    expect(mine.map((p) => p.id).sort()).toEqual([...poemIds].sort());
    expect(mine[0]).toMatchObject({
      favorited: false,
      shared: false,
      writers: ['Poet1', 'Poet2'].sort() && mine[0]!.writers,
    });
    expect(mine[0]!.firstLine).toMatch(/r1w1$/);
    expect((await call('GET', '/api/poems', { token: outsider.token })).body).toEqual([]);

    await call('POST', `/api/poems/${poemIds[1]}/favorite`, { token: players[0]!.token, body: { on: true } });
    const sorted = (await call<ArchiveEntry[]>('GET', '/api/poems', { token: players[0]!.token })).body;
    expect(sorted.map((p) => [p.id, p.favorited])).toEqual([
      [poemIds[1], true],
      [poemIds[0], false],
    ]);
    // A favorite is personal: the other participant's archive is unchanged.
    expect(
      (await call<ArchiveEntry[]>('GET', '/api/poems', { token: players[1]!.token })).body.every((p) => !p.favorited)
    ).toBe(true);
  });

  it('never authorizes a private read by room code, pen name, poem id or missing credential', async () => {
    const { code, players, poemIds } = await finished(2);
    const outsider = await guest('Poet1');
    const id = poemIds[0]!;
    for (const reply of [
      await call('GET', `/api/poems/${id}`, { token: outsider.token }),
      await call('GET', `/api/poems/${id}`),
      await call('GET', `/api/poems/${id}?share=${code}`, { token: outsider.token }),
      await call('GET', `/api/poems/${id}?share=${id}`),
      await call('GET', `/api/poems/${id}?share=`),
    ]) {
      expect(reply.status).toBe(404);
      expect(JSON.stringify(reply.body)).not.toMatch(/Poet\dr\d/);
    }
    const owner = await call<PoemView>('GET', `/api/poems/${id}`, { token: players[0]!.token });
    expect(owner.status).toBe(200);
    expect(owner.body.lines).toHaveLength(9);
    expect(owner.body).toMatchObject({ participant: true, share: { active: false, path: null } });
  });

  it('keeps ended and unfinished games out of the archive and every share surface', async () => {
    const { code, players } = await party(2);
    await start(code, players[0]!);
    for (let round = 0; round < 4; round++) await playRound(code, players, round);
    const poemId = (await state(code, players[0]!)).body.game!.assignment!.poemId;
    expect((await call('GET', '/api/poems', { token: players[0]!.token })).body).toEqual([]);
    expect((await call('GET', `/api/poems/${poemId}`, { token: players[0]!.token })).status).toBe(404);
    expect((await call('POST', `/api/poems/${poemId}/share`, { token: players[0]!.token })).status).toBe(404);
    await call('POST', `/api/rooms/${code}/end`, { token: players[0]!.token });
    expect((await call('GET', '/api/poems', { token: players[0]!.token })).body).toEqual([]);
    expect((await call('GET', `/api/poems/${poemId}`, { token: players[0]!.token })).status).toBe(404);
  });
});

describe('[L1-4.3] favorites are private', () => {
  it('toggles a personal heart without changing public visibility', async () => {
    const { players, poemIds } = await finished(2);
    const id = poemIds[0]!;
    const on = await call('POST', `/api/poems/${id}/favorite`, { token: players[0]!.token, body: { on: true } });
    expect(on.body).toEqual({ poemId: id, favorited: true, hearts: 1 });
    // Setting the same value again is harmless.
    expect(
      (await call('POST', `/api/poems/${id}/favorite`, { token: players[0]!.token, body: { on: true } })).body.hearts
    ).toBe(1);
    expect((await call<FavoriteEntry[]>('GET', '/api/favorites', { token: players[0]!.token })).body).toMatchObject([
      { id, available: true },
    ]);
    expect((await call('GET', `/api/poems/${id}`)).status).toBe(404);
    expect((await call<PoemView>('GET', `/api/poems/${id}`, { token: players[0]!.token })).body.share.active).toBe(
      false
    );
    // Omitting `on` toggles.
    const off = await call('POST', `/api/poems/${id}/favorite`, { token: players[0]!.token });
    expect(off.body).toEqual({ poemId: id, favorited: false, hearts: 0 });
    expect((await call('GET', '/api/favorites', { token: players[0]!.token })).body).toEqual([]);
  });
});

describe('[L1-4.4]–[L1-4.6] explicit, reversible sharing', () => {
  it('publishes only after confirmation, serves the link to anyone, and stops on revoke', async () => {
    const { players, poemIds } = await finished(2);
    const id = poemIds[0]!;
    const attempt = await call<ShareAttempt>('POST', `/api/poems/${id}/share`, { token: players[0]!.token });
    expect(attempt.status).toBe(201);
    expect(attempt.body).toMatchObject({ active: false });
    expect(attempt.body.path).toBe(`/poem/${id}?share=${attempt.body.token}`);
    expect(attempt.body.token.length).toBeGreaterThanOrEqual(32);

    // Pending: exposes nothing, as API or as page.
    expect((await call('GET', `/api/poems/${id}?share=${attempt.body.token}`)).status).toBe(404);
    expect((await call('GET', attempt.body.path, { headers: { accept: 'text/html' } })).status).toBe(404);

    const confirmed = await call<ShareAttempt>('POST', `/api/poems/${id}/share/confirm`, {
      token: players[0]!.token,
      body: { token: attempt.body.token },
    });
    expect(confirmed.body).toMatchObject({ active: true, path: attempt.body.path });

    const anyone = await call<PoemView>('GET', `/api/poems/${id}?share=${attempt.body.token}`);
    expect(anyone.status).toBe(200);
    expect(anyone.body.lines).toHaveLength(9);
    expect(anyone.body).toMatchObject({ participant: false, gameId: '', share: { active: false, path: null } });
    expect((await call('GET', attempt.body.path, { headers: { accept: 'text/html' } })).status).toBe(200);
    // The link authorizes this poem only; the bare id and other poems stay private.
    expect((await call('GET', `/api/poems/${id}`)).status).toBe(404);
    expect((await call('GET', `/api/poems/${poemIds[1]}?share=${attempt.body.token}`)).status).toBe(404);
    expect((await call('GET', `/api/poems/${id}?share=${attempt.body.token}x`)).status).toBe(404);

    // Sharing again while public returns the same link.
    const again = await call<ShareAttempt>('POST', `/api/poems/${id}/share`, { token: players[1]!.token });
    expect(again.body).toMatchObject({ active: true, token: attempt.body.token });

    // An outsider cannot revoke; a participant can.
    const outsider = await guest('Eve');
    expect((await call('DELETE', `/api/poems/${id}/share`, { token: outsider.token })).status).toBe(404);
    expect((await call('DELETE', `/api/poems/${id}/share`, { token: players[1]!.token })).status).toBe(200);
    expect((await call('GET', `/api/poems/${id}?share=${attempt.body.token}`)).status).toBe(404);
    expect((await call('GET', attempt.body.path, { headers: { accept: 'text/html' } })).status).toBe(404);

    // Share again later: a new, different link; the revoked one stays dead.
    const fresh = await publish(players[0]!, id);
    expect(fresh.token).not.toBe(attempt.body.token);
    expect((await call('GET', `/api/poems/${id}?share=${fresh.token}`)).status).toBe(200);
    expect((await call('GET', `/api/poems/${id}?share=${attempt.body.token}`)).status).toBe(404);
  });

  it('leaves the link inactive on cancel and after the 30-second timeout', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const { players, poemIds } = await finished(2);
    const id = poemIds[0]!;
    const cancelled = (await call<ShareAttempt>('POST', `/api/poems/${id}/share`, { token: players[0]!.token })).body;
    expect(
      (
        await call('POST', `/api/poems/${id}/share/cancel`, {
          token: players[0]!.token,
          body: { token: cancelled.token },
        })
      ).body
    ).toEqual({ cancelled: true });
    const afterCancel = await call('POST', `/api/poems/${id}/share/confirm`, {
      token: players[0]!.token,
      body: { token: cancelled.token },
    });
    expect(afterCancel.status).toBe(409);
    expect((await call('GET', `/api/poems/${id}?share=${cancelled.token}`)).status).toBe(404);

    const slow = (await call<ShareAttempt>('POST', `/api/poems/${id}/share`, { token: players[0]!.token })).body;
    vi.setSystemTime(Date.now() + SHARE_PENDING_MS + 1);
    const late = await call('POST', `/api/poems/${id}/share/confirm`, {
      token: players[0]!.token,
      body: { token: slow.token },
    });
    expect(late.status).toBe(409);
    expect(late.body.error.code).toBe('share_inactive');
    expect((await call('GET', `/api/poems/${id}?share=${slow.token}`)).status).toBe(404);
    expect((await call<PoemView>('GET', `/api/poems/${id}`, { token: players[0]!.token })).body.share.active).toBe(
      false
    );
  });

  it('does not let a late or stale completion override or cancel a newer one', async () => {
    const { players, poemIds } = await finished(2);
    const id = poemIds[0]!;
    const older = (await call<ShareAttempt>('POST', `/api/poems/${id}/share`, { token: players[0]!.token })).body;
    await new Promise((resolve) => setTimeout(resolve, 5));
    const newer = (await call<ShareAttempt>('POST', `/api/poems/${id}/share`, { token: players[0]!.token })).body;
    // The older attempt completes late: refused while a newer attempt exists.
    const stale = await call('POST', `/api/poems/${id}/share/confirm`, {
      token: players[0]!.token,
      body: { token: older.token },
    });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe('share_stale');
    expect(
      (await call('POST', `/api/poems/${id}/share/confirm`, { token: players[0]!.token, body: { token: newer.token } }))
        .status
    ).toBe(200);
    // A stale cancel of the older attempt changes nothing.
    expect(
      (await call('POST', `/api/poems/${id}/share/cancel`, { token: players[0]!.token, body: { token: older.token } }))
        .body
    ).toEqual({ cancelled: false });
    expect((await call('GET', `/api/poems/${id}?share=${newer.token}`)).status).toBe(200);
    expect((await call('GET', `/api/poems/${id}?share=${older.token}`)).status).toBe(404);
    // Another participant cannot confirm someone else's attempt.
    await call('DELETE', `/api/poems/${id}/share`, { token: players[0]!.token });
    const mine = (await call<ShareAttempt>('POST', `/api/poems/${id}/share`, { token: players[0]!.token })).body;
    expect(
      (await call('POST', `/api/poems/${id}/share/confirm`, { token: players[1]!.token, body: { token: mine.token } }))
        .status
    ).toBe(404);
  });

  it('offers sharing only for a completed, revealed poem', async () => {
    const { code, players } = await party(2);
    const view = await playGame(code, players);
    const hidden = view.game!.circle!.poems[0]!.id;
    const refused = await call('POST', `/api/poems/${hidden}/share`, { token: players[0]!.token });
    expect(refused.status).toBe(409);
    expect(refused.body.error.code).toBe('not_revealed');
    await revealAll(code, players);
    expect((await call('POST', `/api/poems/${hidden}/share`, { token: players[0]!.token })).status).toBe(201);
  });

  it('lets a reader favorite a public poem, and hides its text again once revoked', async () => {
    const { players, poemIds } = await finished(2);
    const id = poemIds[0]!;
    const share = await publish(players[0]!, id);
    const reader = await guest('Reader');
    expect((await call('POST', `/api/poems/${id}/favorite`, { token: reader.token, body: { on: true } })).status).toBe(
      404
    );
    const hearted = await call('POST', `/api/poems/${id}/favorite`, {
      token: reader.token,
      body: { on: true, share: share.token },
    });
    expect(hearted.status).toBe(200);
    expect((await call<FavoriteEntry[]>('GET', '/api/favorites', { token: reader.token })).body[0]).toMatchObject({
      id,
      available: true,
    });
    await call('DELETE', `/api/poems/${id}/share`, { token: players[0]!.token });
    const hidden = (await call<FavoriteEntry[]>('GET', '/api/favorites', { token: reader.token })).body;
    expect(hidden).toMatchObject([{ id, available: false, firstLine: null }]);
    expect(JSON.stringify(hidden)).not.toMatch(/Poet\dr\d/);
    expect(
      (await call('POST', `/api/poems/${id}/favorite`, { token: reader.token, body: { on: false } })).body.favorited
    ).toBe(false);
    expect((await call('GET', '/api/favorites', { token: reader.token })).body).toEqual([]);
  });
});

describe('[L1-4.8] full-session recap sharing', () => {
  it('is offered only after every poem is revealed and is independent of per-poem links', async () => {
    const { code, players } = await party(2);
    const view = await playGame(code, players);
    const gameId = view.game!.id;
    const early = await call('POST', `/api/recaps/${gameId}/share`, { token: players[0]!.token });
    expect(early.status).toBe(409);
    const done = await revealAll(code, players);
    const poemId = done.game!.circle!.poems[0]!.id;

    const attempt = (await call<ShareAttempt>('POST', `/api/recaps/${gameId}/share`, { token: players[0]!.token }))
      .body;
    expect(attempt.path).toBe(`/recap/${gameId}?share=${attempt.token}`);
    expect((await call('GET', `/api/recaps/${gameId}?share=${attempt.token}`)).status).toBe(404);
    await call('POST', `/api/recaps/${gameId}/share/confirm`, {
      token: players[0]!.token,
      body: { token: attempt.token },
    });
    const recap = await call<RecapView>('GET', `/api/recaps/${gameId}?share=${attempt.token}`);
    expect(recap.status).toBe(200);
    expect(recap.body.poems).toHaveLength(2);
    expect(recap.body.poems[0]!.lines).toHaveLength(9);
    expect(recap.body.participant).toBe(false);
    // The recap link does not publish the poems individually, and vice versa.
    expect((await call('GET', `/api/poems/${poemId}?share=${attempt.token}`)).status).toBe(404);
    const poemShare = await publish(players[0]!, poemId);
    await call('DELETE', `/api/recaps/${gameId}/share`, { token: players[0]!.token });
    expect((await call('GET', `/api/recaps/${gameId}?share=${attempt.token}`)).status).toBe(404);
    expect((await call('GET', `/api/poems/${poemId}?share=${poemShare.token}`)).status).toBe(200);
    expect((await call('GET', `/api/recaps/${gameId}`, { token: (await guest('Eve')).token })).status).toBe(404);
    expect((await call('GET', `/api/recaps/${gameId}`, { token: players[1]!.token })).status).toBe(200);
  });
});

describe('[L1-4.9] bounded retention', () => {
  const sweep = () => runInDurableObject(archiveStub(), (instance: ArchiveDO) => instance.sweep());

  it('cleans private poems after 90 days, protects favorited and public poems, then applies a 30-day grace', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const { players, poemIds } = await finished(3);
    const [plain, loved, shared] = poemIds as [string, string, string];
    await call('POST', `/api/poems/${loved}/favorite`, { token: players[0]!.token, body: { on: true } });
    await publish(players[0]!, shared);

    vi.setSystemTime(Date.now() + PRIVATE_RETENTION_MS - DAY);
    expect(await sweep()).toMatchObject({ eligible: 0, deleted: 0 });

    vi.setSystemTime(Date.now() + 2 * DAY);
    expect(await sweep()).toMatchObject({ eligible: 1, deleted: 1, dryRun: false });
    const owner = await renewed(players[0]!);
    const left = (await call<ArchiveEntry[]>('GET', '/api/poems', { token: owner.token })).body.map((p) => p.id);
    expect(left.sort()).toEqual([loved, shared].sort());
    expect((await call('GET', `/api/poems/${plain}`, { token: owner.token })).status).toBe(404);

    // Protection removed: a 30-day grace period starts.
    await call('POST', `/api/poems/${loved}/favorite`, { token: owner.token, body: { on: false } });
    await call('DELETE', `/api/poems/${shared}/share`, { token: owner.token });
    vi.setSystemTime(Date.now() + PROTECTION_GRACE_MS - DAY);
    expect(await sweep()).toMatchObject({ eligible: 0, deleted: 0 });
    vi.setSystemTime(Date.now() + 2 * DAY);
    expect(await sweep()).toMatchObject({ eligible: 2, deleted: 2 });
    expect((await call('GET', '/api/poems', { token: (await renewed(owner)).token })).body).toEqual([]);
  });

  it('only reports eligibility while deletion is not enabled', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const { players, poemIds } = await finished(2);
    vi.setSystemTime(Date.now() + PRIVATE_RETENTION_MS + DAY);
    const report = await runInDurableObject(archiveStub(), (instance: ArchiveDO) => {
      const env = (instance as unknown as { env: { RETENTION_GC_ENABLED?: string } }).env;
      const before = env.RETENTION_GC_ENABLED;
      env.RETENTION_GC_ENABLED = '0';
      try {
        return instance.sweep();
      } finally {
        env.RETENTION_GC_ENABLED = before;
      }
    });
    expect(report).toEqual({ eligible: 2, deleted: 0, dryRun: true });
    expect(
      (await call<ArchiveEntry[]>('GET', '/api/poems', { token: (await renewed(players[0]!)).token })).body
        .map((p) => p.id)
        .sort()
    ).toEqual([...poemIds].sort());
  });

  it('runs the sweep from the daily alarm', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const { players } = await finished(2);
    vi.setSystemTime(Date.now() + PRIVATE_RETENTION_MS + DAY);
    expect(await runDurableObjectAlarm(archiveStub())).toBe(true);
    expect((await call('GET', '/api/poems', { token: (await renewed(players[0]!)).token })).body).toEqual([]);
  });

  it('deletes the partial lines of an abandoned game after 7 days and never archives them', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const { code, players } = await party(2);
    await start(code, players[0]!);
    await playRound(code, players, 0);
    await call('POST', `/api/rooms/${code}/end`, { token: players[0]!.token });
    const room = bindings.ROOM.get(bindings.ROOM.idFromName(code));
    const count = () =>
      runInDurableObject(
        room,
        (_instance, ctx) => ctx.storage.sql.exec('SELECT COUNT(*) AS n FROM lines').one().n as number
      );
    expect(await count()).toBe(2);
    vi.setSystemTime(Date.now() + ABANDONED_RETENTION_MS + DAY);
    await runDurableObjectAlarm(room);
    expect(await count()).toBe(0);
    expect((await call('GET', '/api/poems', { token: (await renewed(players[0]!)).token })).body).toEqual([]);
  });

  // The retired stack ran this as a minutely `linejam-abandonment-sweep` cron
  // (Sentry issue 7795445353). Now the room arms its own alarm; nothing external
  // schedules or monitors it.
  it('ends a writing game nobody touched for 7 days from the room’s own alarm, with no external scheduler', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const { code, players } = await party(2);
    await start(code, players[0]!);
    await playRound(code, players, 0);
    const room = bindings.ROOM.get(bindings.ROOM.idFromName(code));
    const inspect = () =>
      runInDurableObject(room, async (_instance, ctx) => ({
        alarm: await ctx.storage.getAlarm(),
        status: ctx.storage.sql.exec('SELECT status FROM games ORDER BY cycle DESC LIMIT 1').one().status,
        lines: ctx.storage.sql.exec('SELECT COUNT(*) AS n FROM lines').one().n,
      }));
    const before = await inspect();
    expect(before).toMatchObject({ status: 'writing', lines: 2 });
    expect(before.alarm).not.toBeNull();

    // One day short of the threshold, the game is untouched.
    vi.setSystemTime(Date.now() + ABANDONED_RETENTION_MS - DAY);
    await runDurableObjectAlarm(room);
    expect(await inspect()).toMatchObject({ status: 'writing', lines: 2 });

    vi.setSystemTime(Date.now() + 2 * DAY);
    expect(await runDurableObjectAlarm(room)).toBe(true);
    const after = await inspect();
    expect(after).toMatchObject({ status: 'ended', lines: 0 });
    // The room re-arms itself for its 90-day idle removal.
    expect(after.alarm).not.toBeNull();
    const view = await state(code, await renewed(players[0]!));
    expect(view.body.phase).toBe('lobby');
    expect(view.body.game).toBeNull();
    expect((await call('GET', '/api/poems', { token: (await renewed(players[0]!)).token })).body).toEqual([]);
  });
});

describe('[L1-5.4] legacy data is imported, never invented or reset', () => {
  const adminKey = 'local-test-admin-key-0123456789abcdef';
  const batch = (guestId: string) => ({
    games: [
      {
        gameId: 'legacygame1',
        roomCode: null,
        completedAt: 1_760_000_000_000,
        participants: [guestId, 'guest-other'],
        writers: ['Wren', 'Sol'],
        poems: [
          {
            id: 'legacypoem1',
            ord: 0,
            readerName: 'Sol',
            revealedAt: 1_760_000_100_000,
            lines: Array.from({ length: 9 }, (_, idx) => ({
              idx,
              text: `legacy line ${idx + 1}`,
              authorName: idx % 2 ? 'Sol' : 'Wren',
            })),
          },
        ],
      },
    ],
    favorites: [{ guestId, poemId: 'legacypoem1', createdAt: 1_760_000_200_000 }],
    shares: [
      {
        kind: 'poem',
        targetId: 'legacypoem1',
        token: 'legacy-slug-abc123',
        createdBy: guestId,
        activatedAt: 1_760_000_300_000,
      },
    ],
  });

  it('refuses the import route without the operator key', async () => {
    const player = await guest('Wren');
    expect((await call('POST', '/api/admin/import', { body: batch(player.guestId) })).status).toBe(401);
    expect((await call('POST', '/api/admin/import', { token: player.token, body: batch(player.guestId) })).status).toBe(
      401
    );
    expect((await call('POST', '/api/admin/import', { token: 'wrong-key', body: batch(player.guestId) })).status).toBe(
      401
    );
  });

  it('honors imported poems, favorites and published links under their original identifiers, idempotently', async () => {
    const player = await guest('Wren');
    const first = await call('POST', '/api/admin/import', { token: adminKey, body: batch(player.guestId) });
    expect(first.body).toEqual({ games: 1, poems: 1, favorites: 1, shares: 1 });
    const again = await call('POST', '/api/admin/import', { token: adminKey, body: batch(player.guestId) });
    expect(again.body).toEqual({ games: 0, poems: 0, favorites: 0, shares: 0 });

    const archive = (await call<ArchiveEntry[]>('GET', '/api/poems', { token: player.token })).body;
    expect(archive).toMatchObject([{ id: 'legacypoem1', favorited: true, shared: true, firstLine: 'legacy line 1' }]);
    const published = await call<PoemView>('GET', '/api/poems/legacypoem1?share=legacy-slug-abc123');
    expect(published.status).toBe(200);
    expect(published.body.lines[8]).toEqual({ text: 'legacy line 9', by: 'Wren' });
    expect(
      (await call('GET', '/poem/legacypoem1?share=legacy-slug-abc123', { headers: { accept: 'text/html' } })).status
    ).toBe(200);
    expect((await call('GET', '/api/poems/legacypoem1')).status).toBe(404);
    // Revocable like any other link.
    expect((await call('DELETE', '/api/poems/legacypoem1/share', { token: player.token })).status).toBe(200);
    expect((await call('GET', '/api/poems/legacypoem1?share=legacy-slug-abc123')).status).toBe(404);
  });
});
