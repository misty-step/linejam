#!/usr/bin/env node
// Runs only inside the existing local Compose QA image. No raw browser output is published.
import { randomBytes } from 'node:crypto';
import { mkdir, open, writeFile } from 'node:fs/promises';
import { connect, createServer } from 'node:net';
import { chromium, expect } from '@playwright/test';

const ids = JSON.parse(process.env.WALK_STORIES || '[]');
const resultFile = '/artifacts/walk/observations.json';
const base = process.env.E2E_BASE_URL;
const wordCounts = [1, 2, 3, 4, 5, 4, 3, 2, 1];
const selector = {
  hostName: 'host-name-input',
  create: 'host-create-room-button',
  guestName: 'join-name-input',
  join: 'join-room-button',
  start: 'lobby-start-game-button',
  writing: 'writing-phase',
  carried: 'writing-carried-line',
  input: 'writing-line-input',
  slots: 'writing-word-slots',
  submit: 'writing-submit-line-button',
  waiting: 'waiting-phase',
  reveal: 'reveal-phase',
  revealButton: 'reveal-poem-button',
  done: 'poem-done-button',
};
const stories = [];
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function requireCondition(condition, label) {
  if (!condition) throw new Error(`Product observation failed at ${label}`);
}

async function withTransport(action) {
  const app = new URL(base);
  const convex = new URL(process.env.NEXT_PUBLIC_CONVEX_URL);
  const sitePort = Number(process.env.LINEJAM_LOCAL_SITE_PORT);
  const routes = [
    [Number(app.port), 'app', 3000],
    [Number(convex.port), 'convex', 3210],
    [sitePort, 'convex', 3211],
  ];
  requireCondition(
    app.origin === base &&
      app.hostname === '127.0.0.1' &&
      app.protocol === 'http:',
    'local app origin'
  );
  requireCondition(
    convex.hostname === '127.0.0.1' && convex.protocol === 'http:',
    'local Convex origin'
  );
  requireCondition(
    routes.every(
      ([port]) => Number.isInteger(port) && port >= 1024 && port <= 65535
    ),
    'relay ports'
  );
  requireCondition(
    new Set(routes.map(([port]) => port)).size === 3,
    'distinct relay ports'
  );
  const servers = [];
  const sockets = new Set();
  try {
    for (const [port, host, targetPort] of routes) {
      const server = createServer((client) => {
        const upstream = connect({ host, port: targetPort });
        for (const socket of [client, upstream]) {
          sockets.add(socket);
          socket.once('close', () => sockets.delete(socket));
        }
        client.on('error', () => upstream.destroy());
        upstream.on('error', () => client.destroy());
        client.once('close', () => upstream.destroy());
        upstream.once('close', () => client.destroy());
        client.pipe(upstream);
        upstream.pipe(client);
      });
      servers.push(server);
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen({ host: '127.0.0.1', port }, resolve);
      });
    }
    return await action();
  } finally {
    for (const socket of sockets) socket.destroy();
    await Promise.all(
      servers.map((server) => new Promise((resolve) => server.close(resolve)))
    );
  }
}

async function createActor(browser, label) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    acceptDownloads: true,
  });
  // Local Next honors the trusted ingress header on this route. Separate test
  // guests must not accidentally share a signed-session rate-limit bucket.
  const ip = `10.${[0, 0, 0].map(() => 1 + Math.floor(Math.random() * 254)).join('.')}`;
  await context.route('**/api/guest/session*', (route) =>
    route.continue({
      headers: { ...route.request().headers(), 'do-connecting-ip': ip },
    })
  );
  await context.route('**/npm/@clerk/**', (route) => route.abort('failed'));
  const page = await context.newPage();
  return { context, page, label };
}

async function withActors(browser, action) {
  const actors = [];
  try {
    const actor = async (label) => {
      const value = await createActor(browser, label);
      actors.push(value);
      return value;
    };
    return await action(actor);
  } finally {
    await Promise.allSettled(actors.map(({ context }) => context.close()));
  }
}

async function createRoom(host) {
  await host.page.goto(`${base}/host`);
  await expect(host.page.getByTestId(selector.hostName)).toBeVisible();
  await host.page.getByTestId(selector.hostName).fill('Foundation Host');
  await host.page.getByTestId(selector.create).click();
  await host.page.waitForURL(/\/room\/[A-Z0-9]{4}$/);
  const code = new URL(host.page.url()).pathname.split('/').pop();
  requireCondition(/^[A-Z0-9]{4}$/.test(code), 'room code');
  await expect(
    host.page.getByRole('listitem').filter({ hasText: 'Foundation Host' })
  ).toBeVisible();
  return code;
}

async function joinRoom(guest, code) {
  await guest.page.goto(`${base}/join?code=${code}`);
  await expect(guest.page.getByTestId(selector.guestName)).toBeVisible();
  await guest.page.getByTestId(selector.guestName).fill('Foundation Guest');
  await guest.page.getByTestId(selector.join).click();
  await guest.page.waitForURL(`**/room/${code}`);
  await expect(
    guest.page.getByRole('listitem').filter({ hasText: 'Foundation Host' })
  ).toBeVisible();
  await expect(
    guest.page.getByRole('listitem').filter({ hasText: 'Foundation Guest' })
  ).toBeVisible();
}

function cookie(actor) {
  return actor.context
    .cookies(base)
    .then(
      (values) =>
        values.find(({ name }) => name.startsWith('linejam_guest_token_local_'))
          ?.value
    );
}

async function criterion(story, n, action) {
  const item = { n, status: 'fail', observations: {} };
  story.criteria.push(item);
  try {
    item.observations = await action();
    item.status = 'pass';
  } catch {
    story.status = 'fail';
    // Browser errors (URLs, line text, session cookies) stay in private memory.
    item.observations = {};
  }
  return item.status === 'pass';
}

async function walkOne(browser) {
  const story = { id: 'US-001', status: 'pass', criteria: [] };
  stories.push(story);
  await withActors(browser, async (actor) => {
    const host = await actor('host');
    const guest = await actor('guest');
    let code;
    const first = await criterion(story, 1, async () => {
      code = await createRoom(host);
      const before = await cookie(host);
      requireCondition(Boolean(before), 'host guest session cookie');
      await host.page.reload();
      await expect(
        host.page.getByRole('listitem').filter({ hasText: 'Foundation Host' })
      ).toBeVisible();
      requireCondition(
        (await cookie(host)) === before,
        'guest seat survives refresh'
      );
      return {
        codeIssued: true,
        guestCookiePersists: true,
        hostSeatRestored: true,
      };
    });
    const second =
      first &&
      (await criterion(story, 2, async () => {
        await joinRoom(guest, code);
        await expect(
          host.page
            .getByRole('listitem')
            .filter({ hasText: 'Foundation Guest' })
        ).toBeVisible();
        const hostCookie = await cookie(host);
        const guestCookie = await cookie(guest);
        requireCondition(
          Boolean(guestCookie) && hostCookie !== guestCookie,
          'independent account-free guest'
        );
        return {
          secondGuestAdmitted: true,
          independentGuestSession: true,
          bothSeeLobby: true,
        };
      }));
    if (!first)
      story.criteria.push({ n: 2, status: 'unwalked', observations: {} });
    await criterion(story, 3, async () => {
      const health = await fetch(`${base}/api/health`).then((response) =>
        response.json()
      );
      requireCondition(
        health.status === 'ok' && health.env?.clerkPublishableKey === false,
        'Clerk disabled in local runtime'
      );
      if (!second) {
        code = await createRoom(host);
        await joinRoom(guest, code);
      }
      await expect(
        host.page.getByRole('listitem').filter({ hasText: 'Foundation Guest' })
      ).toBeVisible();
      return { noClerkKeyInRuntime: true, guestsAdmittedWithoutClerk: true };
    });
  });
}

function makeLines() {
  const nonce = randomBytes(5).toString('hex');
  const words = ['under', 'silent', 'willows', 'beneath', 'stars'];
  return {
    host: wordCounts.map((count, index) =>
      [`h${nonce}${index}`, ...words.slice(0, count - 1)].join(' ')
    ),
    guest: wordCounts.map((count, index) =>
      [`g${nonce}${index}`, ...words.slice(0, count - 1)].join(' ')
    ),
  };
}

async function expectWriting(page, round, previous, older) {
  const phase = page.getByTestId(selector.writing);
  await expect(phase).toHaveAttribute('data-round', String(round), {
    timeout: 20_000,
  });
  const input = page.getByTestId(selector.input);
  await expect(input).toHaveAttribute(
    'aria-label',
    new RegExp(`Target: ${wordCounts[round - 1]} words?\\.`)
  );
  await expect(page.getByTestId(selector.slots)).toHaveAttribute(
    'aria-label',
    new RegExp(`^0 of ${wordCounts[round - 1]} words?$`)
  );
  const carried = page.getByTestId(selector.carried);
  if (previous) await expect(carried).toContainText(previous);
  else await expect(carried).toHaveCount(0);
  const visible = await phase.innerText();
  for (const line of older) {
    requireCondition(
      !visible.includes(line.split(' ')[0]),
      'older private line hidden'
    );
  }
}

async function submit(actor, line, waitForOtherWriter = false) {
  await actor.page.getByTestId(selector.input).fill(line);
  await expect(actor.page.getByTestId(selector.submit)).toBeEnabled();
  await actor.page.getByTestId(selector.submit).click();
  if (waitForOtherWriter) {
    await expect(actor.page.getByTestId(selector.waiting)).toBeVisible({
      timeout: 20_000,
    });
  }
}

async function setupGame(actor) {
  const host = await actor('host');
  const guest = await actor('guest');
  const code = await createRoom(host);
  await joinRoom(guest, code);
  await host.page.getByTestId(selector.start).filter({ visible: true }).click();
  await expect(host.page.getByTestId(selector.writing)).toHaveAttribute(
    'data-round',
    '1'
  );
  await expect(guest.page.getByTestId(selector.writing)).toHaveAttribute(
    'data-round',
    '1'
  );
  return { host, guest, lines: makeLines(), round: 0 };
}

async function playGame(game, inspect) {
  const { host, guest, lines } = game;
  for (let index = 0; index < wordCounts.length; index++) {
    const round = index + 1;
    if (inspect) {
      const previousHost = index ? lines.guest[index - 1] : null;
      const previousGuest = index ? lines.host[index - 1] : null;
      const submitted = [
        ...lines.host.slice(0, index),
        ...lines.guest.slice(0, index),
      ];
      await expectWriting(
        host.page,
        round,
        previousHost,
        submitted.filter((line) => line !== previousHost)
      );
      await expectWriting(
        guest.page,
        round,
        previousGuest,
        submitted.filter((line) => line !== previousGuest)
      );
    } else {
      await expect(host.page.getByTestId(selector.writing)).toHaveAttribute(
        'data-round',
        String(round)
      );
      await expect(guest.page.getByTestId(selector.writing)).toHaveAttribute(
        'data-round',
        String(round)
      );
    }
    if (inspect && round === 3) {
      // Reconnect while holding an assignment, not just after finishing a game.
      await guest.page.reload();
      await expectWriting(
        guest.page,
        round,
        lines.host[index - 1],
        [...lines.host.slice(0, index), ...lines.guest.slice(0, index)].filter(
          (line) => line !== lines.host[index - 1]
        )
      );
    }
    await submit(host, lines.host[index], true);
    if (inspect && round === 5) {
      // A committed line must remain committed after reconnect, not be offered again.
      await host.page.reload();
      await expect(host.page.getByTestId(selector.waiting)).toBeVisible();
      await expect(host.page.getByTestId(selector.input)).toHaveCount(0);
    }
    await submit(guest, lines.guest[index]);
    game.round = round;
  }
  for (const current of [host, guest])
    await expect(current.page.getByTestId(selector.reveal)).toBeVisible({
      timeout: 30_000,
    });
}

async function reveal(game) {
  const revealed = [];
  for (const current of [game.host, game.guest]) {
    await current.page
      .getByTestId(selector.revealButton)
      .filter({ visible: true })
      .click();
    const list = current.page.getByRole('list', { name: 'Poem lines' });
    await expect(list.getByRole('listitem')).toHaveCount(9);
    const actual = (
      await list.getByRole('listitem').locator('p').allTextContents()
    ).map((text) => text.trim());
    revealed.push(actual);
    await current.page.getByTestId(selector.done).click();
  }
  for (const current of [game.host, game.guest])
    await expect(current.page.getByTestId('session-complete')).toBeVisible();
  const expected = [...game.lines.host, ...game.lines.guest].sort();
  const actual = revealed.flat().sort();
  requireCondition(
    actual.length === 18 &&
      new Set(actual).size === 18 &&
      JSON.stringify(actual) === JSON.stringify(expected),
    'all unique authored lines revealed exactly once'
  );
  return revealed;
}

async function walkTwo(browser) {
  const story = { id: 'US-002', status: 'pass', criteria: [] };
  stories.push(story);
  await withActors(browser, async (actor) => {
    let game;
    const first = await criterion(story, 1, async () => {
      game = await setupGame(actor);
      await playGame(game, true);
      return {
        roundsWithExactPrecedingLine: 8,
        roundsWithWordTarget: 9,
        priorLinesHidden: true,
        twoIndependentWriters: true,
      };
    });
    if (!first) {
      story.criteria.push(
        { n: 2, status: 'unwalked', observations: {} },
        { n: 3, status: 'unwalked', observations: {} }
      );
      return;
    }
    const second = await criterion(story, 2, async () => {
      await reveal(game);
      return {
        poemsRevealed: 2,
        linesPerPoem: 9,
        authoredLinesFoundExactlyOnce: 18,
      };
    });
    // The reconnect happens during playGame; the reveal detects duplicate or missing lines.
    await criterion(story, 3, async () => {
      requireCondition(
        second && game.round === 9,
        'nine-round reconnect and unique reveal journey'
      );
      await expect(
        game.host.page.getByTestId('session-complete')
      ).toBeVisible();
      return {
        writingSeatRestoredOnRefresh: true,
        submittedSeatStaysWaiting: true,
        uniqueContributions: 18,
      };
    });
  });
}

async function outsiderObservation(outsider, url, lines) {
  const maxResponseBytes = 4 * 1024 * 1024;
  const inbound = [];
  const responses = [];
  const wsListener = (ws) =>
    ws.on('framereceived', (frame) => {
      const body = String(frame.payload);
      inbound.push(body.length <= maxResponseBytes ? body : null);
    });
  const responseListener = (response) => {
    // Immutable build assets cannot contain the newly authored fixture lines.
    // Inspect application HTML, Next RSC text/x-component, JSON, and scripts.
    if (new URL(response.url()).pathname.startsWith('/_next/static/')) return;
    const headers = response.headers();
    const type = (headers['content-type'] || '').split(';')[0].toLowerCase();
    if (!(
      type.startsWith('text/') ||
      type.endsWith('+json') ||
      [
        'application/json',
        'application/javascript',
        'application/x-javascript',
        'application/ecmascript',
        'application/x-ndjson',
      ].includes(type)
    ))
      return;
    if (Number(headers['content-length']) > maxResponseBytes) {
      responses.push(Promise.resolve(null));
      return;
    }
    responses.push(
      response.body().then(
        (body) =>
          body.length <= maxResponseBytes ? body.toString('utf8') : null,
        () => null
      )
    );
  };
  outsider.page.on('websocket', wsListener);
  outsider.page.on('response', responseListener);
  try {
    await outsider.page.goto(url);
    await expect(
      outsider.page.getByRole('heading', { name: 'Poem not found' })
    ).toBeVisible({ timeout: 20_000 });
    // Let subscribed Convex queries and their network frames settle before checking.
    await pause(750);
    const cardUrl = `${new URL(url).origin}${new URL(url).pathname}/card`;
    const cardGet = await outsider.page.request.get(cardUrl);
    const cardPost = await outsider.page.request.post(cardUrl, { data: {} });
    requireCondition(
      cardGet.status() === 404 && cardPost.status() === 404,
      'spectator card requests denied'
    );
    let timer;
    let received;
    try {
      received = await Promise.race([
        Promise.all(responses),
        new Promise((resolve) => {
          timer = setTimeout(() => resolve(null), 10_000);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
    requireCondition(
      received !== null &&
        received.every((body) => body !== null) &&
        inbound.every((frame) => frame !== null),
      'all bounded spectator payloads readable'
    );
    const html = await outsider.page.content();
    requireCondition(html.length <= maxResponseBytes, 'bounded spectator HTML');
    const payloads = [
      html,
      ...inbound,
      ...received,
      await cardGet.text(),
      await cardPost.text(),
    ];
    requireCondition(
      lines.every((line) =>
        payloads.every((payload) => !payload.includes(line.split(' ')[0]))
      ),
      'unpublished text absent from spectator DOM and responses'
    );
    return {
      spectatorDenied: true,
      htmlNoAuthoredText: true,
      inboundPayloadNoAuthoredText: true,
      cardRequestsDenied: true,
    };
  } finally {
    outsider.page.off('websocket', wsListener);
    outsider.page.off('response', responseListener);
  }
}

async function walkThree(browser) {
  const story = { id: 'US-003', status: 'pass', criteria: [] };
  stories.push(story);
  await withActors(browser, async (actor) => {
    let game;
    let outsider;
    let poemUrl;
    let poemLines;
    const first = await criterion(story, 1, async () => {
      game = await setupGame(actor);
      await playGame(game, false);
      await reveal(game);
      await game.host.page.goto(`${base}/me/poems`);
      const card = game.host.page.getByTestId('poem-card').first();
      await expect(card).toBeVisible();
      poemUrl = new URL(await card.getAttribute('href'), base);
      requireCondition(
        poemUrl.origin === base && /^\/poem\/[^/]+$/.test(poemUrl.pathname),
        'private archive link'
      );
      await card.click();
      const list = game.host.page.getByRole('list', { name: 'Poem lines' });
      await expect(list.getByRole('listitem')).toHaveCount(9);
      poemLines = (
        await list.getByRole('listitem').locator('p').allTextContents()
      ).map((text) => text.trim());
      requireCondition(
        poemLines.every((line) =>
          [...game.lines.host, ...game.lines.guest].includes(line)
        ),
        'saved archive holds authored text'
      );
      const downloadPromise = game.host.page.waitForEvent('download');
      await game.host.page.getByTestId('poem-save-image-button').click();
      const download = await downloadPromise;
      requireCondition(
        download.suggestedFilename() === 'linejam-poem.png' &&
          (await download.failure()) === null,
        'private saved PNG download'
      );
      const image = await open(await download.path(), 'r');
      try {
        const signature = Buffer.allocUnsafe(8);
        const { bytesRead } = await image.read(signature, 0, 8, 0);
        requireCondition(
          bytesRead === 8 &&
            (await image.stat()).size > 8 &&
            signature.equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
          'saved PNG has real bytes'
        );
      } finally {
        await image.close();
      }
      outsider = await actor('spectator');
      await outsiderObservation(outsider, poemUrl.href, poemLines);
      return {
        participantArchiveLines: 9,
        privatePngDownloaded: true,
        unrelatedGuestDenied: true,
      };
    });
    if (!first) {
      story.criteria.push(
        { n: 2, status: 'unwalked', observations: {} },
        { n: 3, status: 'unwalked', observations: {} }
      );
      return;
    }
    const second = await criterion(story, 2, async () => {
      await game.host.context.grantPermissions(
        ['clipboard-read', 'clipboard-write'],
        { origin: base }
      );
      await game.host.page
        .getByRole('button', { name: 'Share poem', exact: true })
        .click();
      await expect(
        game.host.page
          .getByRole('status')
          .filter({ hasText: 'Poem link copied.' })
      ).toBeVisible({ timeout: 15_000 });
      const shared = new URL(
        await game.host.page.evaluate(() => navigator.clipboard.readText())
      );
      requireCondition(
        shared.origin === base &&
          shared.pathname === poemUrl.pathname &&
          /^[0-9a-f-]{36}$/.test(shared.searchParams.get('share') || ''),
        'explicit public link'
      );
      await outsider.page.goto(shared.href);
      const list = outsider.page.getByRole('list', { name: 'Poem lines' });
      await expect(list.getByRole('listitem')).toHaveCount(9);
      for (const line of poemLines)
        await expect(list.getByText(line, { exact: true })).toBeVisible();
      await game.host.page
        .getByRole('button', { name: 'Revoke public link' })
        .click();
      await expect(
        game.host.page
          .getByRole('status')
          .filter({ hasText: 'Public poem link revoked.' })
      ).toBeVisible();
      const revokedVisitor = await actor('revoked-link visitor');
      await outsiderObservation(revokedVisitor, shared.href, poemLines);
      return {
        explicitLinkCopied: true,
        spectatorCouldReadAfterPublish: true,
        revokeDeniedSameLink: true,
      };
    });
    await criterion(story, 3, async () => {
      // A new independent context cannot retrieve the poem with no slug, a
      // guessed slug, or the revoked link, even from network response frames.
      const stranger = await actor('unrelated spectator');
      await outsiderObservation(stranger, poemUrl.href, poemLines);
      await outsiderObservation(
        stranger,
        `${poemUrl.href}?share=not-a-real-share`,
        poemLines
      );
      requireCondition(second, 'publication-revocation sequence');
      return {
        anonymousHtmlNoText: true,
        anonymousConvexFramesNoText: true,
        guessedSlugDenied: true,
      };
    });
  });
}

async function main() {
  requireCondition(
    process.env.LINEJAM_LOCAL === '1' &&
      process.env.NEXT_PUBLIC_LINEJAM_LOCAL === '1',
    'credential-free local mode'
  );
  requireCondition(
    Array.isArray(ids) && ids.every((id) => /^US-\d{3}$/.test(id)),
    'selected story IDs'
  );
  await mkdir('/artifacts/walk', { recursive: true });
  let browser;
  try {
    await withTransport(async () => {
      const response = await fetch(`${base}/api/health`);
      requireCondition(
        response.ok && (await response.json()).status === 'ok',
        'local runtime health'
      );
      browser = await chromium.launch({ headless: true });
      const walks = {
        'US-001': walkOne,
        'US-002': walkTwo,
        'US-003': walkThree,
      };
      for (const id of ids) {
        if (!walks[id]) {
          stories.push({ id, status: 'unwalked', criteria: [] });
          continue;
        }
        try {
          await walks[id](browser);
        } catch {
          const story = stories.find((item) => item.id === id);
          if (story) story.status = 'fail';
          else stories.push({ id, status: 'fail', criteria: [] });
        }
      }
    });
  } finally {
    if (browser) await browser.close();
    // Strictly fixed keys/values: this file never contains guest tokens, room
    // codes, URL slugs, browser logs, screenshots, or authored text.
    await writeFile(resultFile, `${JSON.stringify({ stories }, null, 2)}\n`, {
      mode: 0o600,
    });
  }
  if (stories.some((story) => story.status !== 'pass')) process.exitCode = 1;
}

main().catch(() => {
  process.exitCode = 1;
});
