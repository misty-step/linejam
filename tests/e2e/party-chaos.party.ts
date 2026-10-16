import {
  test,
  expect,
  type BrowserContext,
  type CDPSession,
  type Page,
} from '@playwright/test';
import { ConvexClient, ConvexHttpClient } from 'convex/browser';
import type { FunctionReturnType } from 'convex/server';
import { mkdir, writeFile } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import { api } from '../../convex/_generated/api';
import { PRESENCE_HEARTBEAT_MS } from '../../convex/lib/gameRules';
import {
  CANONICAL_GUEST_FLOW_LINES as lines,
  isolateGuestSessionIp,
} from './support/guestFlow';

// Eighty real SDK players, not eighty CPU-heavy phone emulators on four cores.
// One phone per room exercises the rendered consumer; the other seven use the
// same public, authenticated WebSocket API, including all three live queries.
const target = new URL(process.env.E2E_BASE_URL || 'http://invalid');
if (target.hostname !== '127.0.0.1' || target.protocol !== 'http:') {
  throw new Error('Party chaos requires the isolated loopback Worker');
}
const ROOM_COUNT = 10;
const PLAYER_COUNT = 8;
type Assignment = FunctionReturnType<typeof api.game.getCurrentAssignment>;
type RoomState = FunctionReturnType<typeof api.rooms.getRoomState>;
type Progress = FunctionReturnType<typeof api.game.getRoundProgress>;
type Actor = {
  name: string;
  token: string;
  client: ConvexClient | ConvexHttpClient;
  assignment?: Assignment;
  state?: RoomState;
  progress?: Progress;
  online: boolean;
  timer?: ReturnType<typeof setInterval>;
  page?: Page;
  context?: BrowserContext;
};
type Room = { code: string; actors: Actor[] };
const errors: string[] = [];

async function mint(room: number, player: number) {
  const response = await fetch(new URL('/api/guest/session', target), {
    headers: { 'cf-connecting-ip': `10.42.${room}.${player + 1}` },
    signal: AbortSignal.timeout(30_000),
  });
  expect(response.status).toBe(200);
  const session: { token: string } = await response.json();
  expect(session.token).toMatch(/^\S+$/);
  return session.token;
}

function connect(actor: Actor, code: string) {
  const client = new ConvexClient(`${target.origin}/backend`, {
    webSocketConstructor: WebSocket,
  });
  actor.client = client;
  actor.online = true;
  actor.assignment = undefined;
  actor.state = undefined;
  actor.progress = undefined;
  const failed = () => {
    if (actor.online) errors.push('live_query_failed');
  };
  client.onUpdate(
    api.game.getCurrentAssignment,
    { roomCode: code, guestToken: actor.token },
    (value) => {
      actor.assignment = value;
    },
    failed
  );
  client.onUpdate(
    api.rooms.getRoomState,
    { code, guestToken: actor.token },
    (value) => {
      actor.state = value;
    },
    failed
  );
  client.onUpdate(
    api.game.getRoundProgress,
    { roomCode: code, guestToken: actor.token },
    (value) => {
      actor.progress = value;
    },
    failed
  );
  const ping = () => {
    void client
      .mutation(api.presence.heartbeat, {
        roomCode: code,
        guestToken: actor.token,
      })
      .catch(failed);
  };
  ping();
  actor.timer = setInterval(ping, PRESENCE_HEARTBEAT_MS);
}

async function disconnect(actor: Actor) {
  actor.online = false;
  clearInterval(actor.timer);
  if (actor.client instanceof ConvexClient) await actor.client.close();
  actor.client = new ConvexHttpClient(`${target.origin}/backend`);
}

async function join(actor: Actor, code: string) {
  if (actor.page) {
    await actor.page.goto(`/join?code=${code}`);
    await actor.page.getByTestId('join-name-input').fill(actor.name);
    await actor.page.getByTestId('join-room-button').click();
    await expect(actor.page).toHaveURL(new RegExp(`/room/${code}$`));
  } else {
    const result = await actor.client.mutation(api.rooms.joinRoom, {
      code,
      displayName: actor.name,
      guestToken: actor.token,
    });
    expect(result.ok).toBe(true);
    connect(actor, code);
  }
}

async function play(rooms: Room[], participants: number) {
  for (let round = 0; round < lines.length; round++) {
    await Promise.all(
      rooms.flatMap((room) =>
        room.actors.slice(0, participants).map(async (actor) => {
          if (actor.page) {
            await expect(
              actor.page.getByTestId('writing-phase')
            ).toHaveAttribute('data-round', String(round + 1));
            await actor.page
              .getByTestId('writing-line-input')
              .fill(lines[round]);
            await actor.page.getByTestId('writing-submit-line-button').click();
          } else {
            await expect.poll(() => actor.assignment?.lineIndex).toBe(round);
            const assignment = actor.assignment!;
            expect(assignment.hasSubmitted).toBe(false);
            await actor.client.mutation(api.game.submitLine, {
              poemId: assignment.poemId,
              lineIndex: round,
              text: lines[round],
              guestToken: actor.token,
            });
          }
        })
      )
    );
    console.log(
      `Party chaos: ${participants} writers per room, round ${round + 1} acknowledged`
    );
  }
  await Promise.all(
    rooms.map(async (room) => {
      await expect(
        room.actors[2].page!.getByTestId('reveal-phase')
      ).toBeVisible();
      await Promise.all(
        room.actors.slice(0, participants).map(async (actor) => {
          if (actor.page) {
            await actor.page
              .getByTestId('reveal-poem-button')
              .filter({ visible: true })
              .click();
            for (const line of lines)
              await expect(
                actor.page.getByText(line, { exact: true })
              ).toBeVisible();
            await actor.page.getByTestId('poem-done-button').click();
          } else {
            const state = await actor.client.query(
              api.game.getRevealPhaseState,
              { roomCode: room.code, guestToken: actor.token }
            );
            expect(state?.myPoem?.lines.map((line) => line.text)).toEqual([
              ...lines,
            ]);
            await actor.client.mutation(api.game.revealPoem, {
              poemId: state!.myPoem!._id,
              guestToken: actor.token,
            });
          }
        })
      );
      await expect(
        room.actors[2].page!.getByTestId('session-complete')
      ).toBeVisible();
      const late = room.actors[7];
      const state = await late.client.query(api.game.getRevealPhaseState, {
        roomCode: room.code,
        guestToken: late.token,
      });
      expect(state?.allRevealed).toBe(true);
    })
  );
}

test('ten eight-person rooms recover and complete a full-party rematch', async ({
  browser,
}, testInfo) => {
  const started = Date.now();
  const rooms: Room[] = [];
  const contexts: BrowserContext[] = [];
  const frozen: CDPSession[] = [];
  errors.length = 0;
  const stages: { stage: string; elapsedMs: number }[] = [];
  const receipt = {
    result: 'FAIL',
    rooms: ROOM_COUNT,
    playersPerRoom: PLAYER_COUNT,
    browserPlayers: ROOM_COUNT,
    websocketAgentPlayers: 0,
    concurrentPlayers: 0,
    completedGames: 0,
    runtimeErrors: 0,
    clientsClosed: false,
    stages,
  };
  await mkdir('.qa/party', { recursive: true });
  await writeFile('.qa/party/receipt.json', JSON.stringify(receipt, null, 2));
  const mark = (stage: string) => {
    stages.push({ stage, elapsedMs: Date.now() - started });
    writeFileSync('.qa/party/progress.json', JSON.stringify(stages));
    console.log(`Party chaos: ${stage}`);
  };
  try {
    for (let index = 0; index < ROOM_COUNT; index++) {
      const room: Room = { code: '', actors: [] };
      rooms.push(room);
      for (let player = 0; player < PLAYER_COUNT; player++) {
        const actor: Actor = {
          name: `Party ${index} writer ${player}`,
          token: '',
          client: new ConvexHttpClient(`${target.origin}/backend`),
          online: false,
        };
        room.actors.push(actor);
        if (player === 2) {
          const context = await browser.newContext({
            baseURL: target.origin,
            viewport: { width: 390, height: 844 },
            isMobile: true,
            hasTouch: true,
            reducedMotion: 'reduce',
          });
          contexts.push(context);
          context.setDefaultTimeout(30_000);
          context.setDefaultNavigationTimeout(30_000);
          await isolateGuestSessionIp(context);
          actor.context = context;
          actor.page = await context.newPage();
          actor.page.on('pageerror', () =>
            errors.push('unhandled_browser_error')
          );
          await actor.page.goto('/join');
          await actor.page.getByTestId('join-name-input').waitFor();
          const session = await (
            await context.request.get('/api/guest/session')
          ).json();
          actor.token = session.token;
        } else actor.token = await mint(index, player);
      }
    }
    mark('eighty_real_issuer_sessions_ready');
    await Promise.all(
      rooms.map(async (room) => {
        const host = room.actors[0];
        const result = await host.client.mutation(api.rooms.createRoom, {
          displayName: host.name,
          guestToken: host.token,
        });
        room.code = result.code;
        connect(host, room.code);
      })
    );
    for (let player = 1; player < 7; player++)
      await Promise.all(
        rooms.map((room) => join(room.actors[player], room.code))
      );
    await Promise.all(
      rooms.map(async (room) => {
        const host = room.actors[0];
        await expect.poll(() => host.state?.players.length).toBe(7);
        await host.client.mutation(api.game.startGame, {
          code: room.code,
          guestToken: host.token,
        });
        await join(room.actors[7], room.code);
        const late = room.actors[7];
        const assignment = await late.client.query(
          api.game.getCurrentAssignment,
          { roomCode: room.code, guestToken: late.token }
        );
        expect(assignment).toBeNull();
        const progress = await late.client.query(api.game.getRoundProgress, {
          roomCode: room.code,
          guestToken: late.token,
        });
        expect(
          progress?.players.filter((player) => !player.isSpectator)
        ).toHaveLength(7);
        expect(progress?.isCurrentUserSpectator).toBe(true);
      })
    );
    receipt.concurrentPlayers = rooms.flatMap((room) => room.actors).length;
    receipt.websocketAgentPlayers = receipt.concurrentPlayers - contexts.length;
    mark('eighty_connected_players_late_arrivals_are_spectators');
    await Promise.all(
      rooms.map(async (room) => {
        const phone = room.actors[2];
        await phone.page!.getByTestId('writing-line-input').fill(lines[0]);
        await phone.page!.reload();
        await expect(phone.page!.getByTestId('writing-line-input')).toHaveValue(
          lines[0]
        );
        const cdp = await phone.context!.newCDPSession(phone.page!);
        frozen.push(cdp);
        await phone.context!.setOffline(true);
        await cdp.send('Page.setWebLifecycleState', { state: 'frozen' });
        await disconnect(room.actors[3]);
        await join(room.actors[3], room.code);
        await disconnect(room.actors[0]);
      })
    );
    await Promise.all(
      rooms.map((room) =>
        expect
          .poll(() => room.actors[1].state?.isHost, { timeout: 100_000 })
          .toBe(true)
      )
    );
    mark('real_presence_heartbeats_healed_absent_hosts');
    await Promise.all(
      rooms.map(async (room, index) => {
        await frozen[index].send('Page.setWebLifecycleState', {
          state: 'active',
        });
        await room.actors[2].context!.setOffline(false);
        await room.actors[2].page!.bringToFront();
        await expect(
          room.actors[2].page!.getByTestId('writing-line-input')
        ).toHaveValue(lines[0]);
        connect(room.actors[0], room.code);
        await expect.poll(() => room.actors[0].state?.isHost).toBe(false);
        expect(room.actors[1].state?.players).toHaveLength(8);
      })
    );
    mark('drafts_and_seats_survive_reload_rejoin_frozen_offline_wake');
    await play(rooms, 7);
    receipt.completedGames += rooms.length;
    mark('ten_seven_writer_games_revealed_exactly_nine_lines');
    await rooms[0].actors[2].page!.screenshot({
      path: testInfo.outputPath('party-complete.png'),
      fullPage: true,
    });
    await Promise.all(
      rooms.map(async (room) => {
        await room.actors[2]
          .page!.getByRole('button', { name: 'Play again', exact: true })
          .click();
        const actor = room.actors[1];
        await expect(
          room.actors[2].page!.getByTestId('writing-phase')
        ).toHaveAttribute('data-round', '1');
        await expect
          .poll(
            () =>
              actor.progress?.players.filter((player) => !player.isSpectator)
                .length
          )
          .toBe(8);
      })
    );
    await play(rooms, 8);
    receipt.completedGames += rooms.length;
    mark('all_eighty_writers_complete_nine_round_rematch');
    await Promise.all(
      rooms.map(async (room, index) => {
        const token = await mint(index, PLAYER_COUNT);
        const client = new ConvexHttpClient(`${target.origin}/backend`);
        const denied = await client.mutation(api.rooms.joinRoom, {
          code: room.code,
          displayName: 'Ninth writer',
          guestToken: token,
        });
        expect(denied).toMatchObject({ ok: false, code: 'ROOM_FULL' });
        const host = room.actors[1];
        await host.client.mutation(api.rooms.closeRoom, {
          roomCode: room.code,
          guestToken: host.token,
        });
        const closed = await client.mutation(api.rooms.joinRoom, {
          code: room.code,
          displayName: 'Ninth writer',
          guestToken: token,
        });
        expect(closed).toMatchObject({ ok: false, code: 'ROOM_NOT_OPEN' });
      })
    );
    mark('full_and_closed_rooms_refuse_fresh_identity');
    expect(errors).toEqual([]);
    receipt.result = 'PASS';
  } finally {
    await Promise.allSettled(
      frozen.map((session) =>
        session.send('Page.setWebLifecycleState', { state: 'active' })
      )
    );
    await Promise.allSettled(
      contexts.map((context) => context.setOffline(false))
    );
    if (receipt.result !== 'PASS')
      await writeFile(
        testInfo.outputPath('failure-state.json'),
        JSON.stringify(
          rooms.map((room, roomIndex) => ({
            roomIndex,
            actors: room.actors.map((actor, actorIndex) => ({
              actorIndex,
              round: actor.assignment?.lineIndex,
              submitted: actor.assignment?.hasSubmitted,
              online: actor.online,
              players: actor.state?.players.length,
              host: actor.state?.isHost,
            })),
          })),
          null,
          2
        )
      );
    const closed = await Promise.allSettled([
      ...rooms.flatMap((room) => room.actors).map(disconnect),
      ...contexts.map((context) => context.close()),
    ]);
    receipt.clientsClosed = closed.every(
      (result) => result.status === 'fulfilled'
    );
    receipt.runtimeErrors = errors.length;
    if (!receipt.clientsClosed) receipt.result = 'FAIL';
    await writeFile(
      '.qa/party/receipt.json',
      JSON.stringify(receipt, null, 2) + '\n'
    );
    expect(receipt.clientsClosed).toBe(true);
  }
});
