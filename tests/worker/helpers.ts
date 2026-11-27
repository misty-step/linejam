import { env, exports } from 'cloudflare:workers';
import { ROUND_WORDS } from '../../shared/rules.ts';
import type { RoomView } from '../../shared/types.ts';
import type { Env } from '../../src/env.ts';

export const ORIGIN = 'http://linejam.test';
export const bindings = env as unknown as Env;

export interface Reply<T = any> {
  status: number;
  body: T;
  headers: Headers;
}

export interface Player {
  guestId: string;
  token: string;
  name: string;
}

export async function call<T = any>(
  method: string,
  path: string,
  options: { token?: string | null; body?: unknown; headers?: Record<string, string> } = {}
): Promise<Reply<T>> {
  const headers: Record<string, string> = { ...options.headers };
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  let body: string | undefined;
  if (method !== 'GET' && method !== 'HEAD') {
    headers['content-type'] ??= 'application/json';
    body = JSON.stringify(options.body ?? {});
  }
  const worker = (exports as unknown as { default: { fetch(request: Request): Promise<Response> } }).default;
  const response = await worker.fetch(new Request(ORIGIN + path, { method, headers, body }));
  const text = await response.text();
  let parsed: unknown = text;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    // Not JSON (HTML, plain text).
  }
  return { status: response.status, body: parsed as T, headers: response.headers };
}

export async function guest(name = 'Guest'): Promise<Player> {
  const reply = await call('POST', '/api/guest');
  if (reply.status !== 201) throw new Error(`mint failed: ${reply.status}`);
  return { guestId: reply.body.guestId, token: reply.body.token, name };
}

const EMBLEMS = ['loom', 'vesper', 'prism', 'clover', 'orrery', 'arch', 'pinwheel', 'lattice'];

/** A room with `count` players; the first is the host. */
export async function party(count: number): Promise<{ code: string; players: Player[] }> {
  const players: Player[] = [];
  for (let i = 0; i < count; i++) players.push(await guest(`Poet${i + 1}`));
  const host = players[0]!;
  const created = await call<RoomView>('POST', '/api/rooms', {
    token: host.token,
    body: { penName: host.name, emblem: EMBLEMS[0] },
  });
  if (created.status !== 201) throw new Error(`create failed: ${created.status} ${JSON.stringify(created.body)}`);
  const code = created.body.code;
  for (let i = 1; i < count; i++) {
    const joined = await call('POST', `/api/rooms/${code}/join`, {
      token: players[i]!.token,
      body: { penName: players[i]!.name, emblem: EMBLEMS[i % EMBLEMS.length] },
    });
    if (joined.status !== 200) throw new Error(`join failed: ${joined.status} ${JSON.stringify(joined.body)}`);
  }
  return { code, players };
}

export function state(code: string, player: Player): Promise<Reply<RoomView>> {
  return call<RoomView>('GET', `/api/rooms/${code}`, { token: player.token });
}

/** `words` words, tagged so every line in a game is unique and traceable. */
export function line(tag: string, words: number): string {
  return Array.from({ length: words }, (_, i) => `${tag}w${i + 1}`).join(' ');
}

export function lineTag(player: Player, round: number): string {
  return `${player.name}r${round + 1}`;
}

/** Every writer submits a valid line for the current round. */
export async function playRound(code: string, writers: Player[], round: number): Promise<void> {
  for (const writer of writers) {
    const view = (await state(code, writer)).body;
    const assignment = view.game!.assignment!;
    const reply = await call('POST', `/api/rooms/${code}/lines`, {
      token: writer.token,
      body: { poemId: assignment.poemId, lineIndex: assignment.lineIndex, text: line(lineTag(writer, round), ROUND_WORDS[round]!) },
    });
    if (reply.status !== 200) throw new Error(`submit failed r${round}: ${reply.status} ${JSON.stringify(reply.body)}`);
  }
}

export async function start(code: string, host: Player): Promise<Reply<RoomView>> {
  return call<RoomView>('POST', `/api/rooms/${code}/start`, { token: host.token });
}

/** Start and write all nine rounds. Leaves the room in the reading circle. */
export async function playGame(code: string, players: Player[]): Promise<RoomView> {
  const started = await start(code, players[0]!);
  if (started.status !== 200) throw new Error(`start failed: ${started.status} ${JSON.stringify(started.body)}`);
  for (let round = 0; round < ROUND_WORDS.length; round++) await playRound(code, players, round);
  return (await state(code, players[0]!)).body;
}

/** Reveal every poem in order, each by its assigned reader. */
export async function revealAll(code: string, players: Player[]): Promise<RoomView> {
  for (;;) {
    const views = await Promise.all(players.map((p) => state(code, p)));
    const circle = views[0]!.body.game!.circle!;
    if (!circle.nextPoemId) return views[0]!.body;
    const readerIndex = views.findIndex((v) => v.body.game!.circle!.poems.find((p) => p.id === circle.nextPoemId)!.readerIsYou);
    const reply = await call('POST', `/api/rooms/${code}/reveal`, {
      token: players[readerIndex]!.token,
      body: { poemId: circle.nextPoemId },
    });
    if (reply.status !== 200) throw new Error(`reveal failed: ${reply.status} ${JSON.stringify(reply.body)}`);
  }
}
