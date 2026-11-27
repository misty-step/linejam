import { DurableObject } from 'cloudflare:workers';
import {
  MAX_PEN_NAME_CHARS,
  MIN_PLAYERS,
  ROOM_CAPACITY,
  ROUNDS,
  ROUND_WORDS,
  checkLine,
  isEmblem,
  normalizeLine,
  normalizePenName,
  poemForSeat,
  readerSeat,
  type Emblem,
} from '../shared/rules.ts';
import type {
  AssignmentView,
  CircleView,
  GameView,
  MemberView,
  Phase,
  Presence,
  RoomView,
  SubmitResult,
} from '../shared/types.ts';
import type { Env } from './env.ts';
import { Reject, attempt, attemptAsync, randomId, shuffle, type Result } from './http.ts';
import { measure } from './measure.ts';

/** An HTTP-only player (CLI, MCP, polling browser) counts as present this long after a call. */
export const LEASE_MS = 45_000;
/** After presence drops, a player is `reconnecting` this long before they are `away`. */
export const GRACE_MS = 15_000;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Abandoned work (an ended game, or a game nobody touched) is cleaned up after 7 days. */
export const ABANDONED_RETENTION_MS = 7 * DAY_MS;
/** A room nobody touched for 90 days is removed, releasing its code. */
export const IDLE_ROOM_RETENTION_MS = 90 * DAY_MS;
const ARCHIVE_RETRY_MS = 5_000;

type Row = Record<string, SqlStorageValue>;

interface RoomRow extends Row {
  code: string;
  status: 'open' | 'closed';
  host_id: string;
  version: number;
  presence_sig: string;
  last_activity_at: number;
}

interface MemberRow extends Row {
  guest_id: string;
  seat: number;
  pen_name: string;
  emblem: Emblem;
  left_at: number | null;
  lease_until: number;
  dropped_at: number;
}

interface GameRow extends Row {
  id: string;
  cycle: number;
  status: 'writing' | 'reading' | 'complete' | 'ended';
  round: number;
  started_at: number;
  completed_at: number | null;
  ended_at: number | null;
  archived_at: number | null;
  dismissed: number;
}

interface WriterRow extends Row {
  game_id: string;
  seat: number;
  guest_id: string;
  pen_name: string;
  emblem: Emblem;
}

interface PoemRow extends Row {
  id: string;
  game_id: string;
  ord: number;
  reader_seat: number;
  revealed_at: number | null;
}

interface LineRow extends Row {
  poem_id: string;
  idx: number;
  text: string;
  author_id: string;
  author_name: string;
  created_at: number;
}

export interface Entry {
  guestId: string;
  penName: unknown;
  emblem: unknown;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS room (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  code TEXT NOT NULL,
  status TEXT NOT NULL,
  host_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  presence_sig TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_activity_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS members (
  guest_id TEXT PRIMARY KEY,
  seat INTEGER NOT NULL UNIQUE,
  pen_name TEXT NOT NULL,
  emblem TEXT NOT NULL,
  joined_at INTEGER NOT NULL,
  left_at INTEGER,
  lease_until INTEGER NOT NULL,
  dropped_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  cycle INTEGER NOT NULL UNIQUE,
  status TEXT NOT NULL,
  round INTEGER NOT NULL,
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  ended_at INTEGER,
  archived_at INTEGER,
  dismissed INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS writers (
  game_id TEXT NOT NULL,
  seat INTEGER NOT NULL,
  guest_id TEXT NOT NULL,
  pen_name TEXT NOT NULL,
  emblem TEXT NOT NULL,
  PRIMARY KEY (game_id, seat)
);
CREATE TABLE IF NOT EXISTS poems (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL,
  ord INTEGER NOT NULL,
  reader_seat INTEGER NOT NULL,
  revealed_at INTEGER,
  UNIQUE (game_id, ord)
);
CREATE TABLE IF NOT EXISTS lines (
  poem_id TEXT NOT NULL,
  idx INTEGER NOT NULL,
  text TEXT NOT NULL,
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (poem_id, idx)
);
CREATE TABLE IF NOT EXISTS hearts (
  poem_id TEXT NOT NULL,
  guest_id TEXT NOT NULL,
  PRIMARY KEY (poem_id, guest_id)
);
`;

/**
 * One room. This object's SQLite database is the only authority for the
 * room's members, presence, games, assignments and accepted lines; every
 * face (browser, CLI, MCP) reaches it through the same Worker routes.
 */
export class RoomDO extends DurableObject<Env> {
  private readonly sql: SqlStorage;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  // ───────────────────────── storage helpers ─────────────────────────

  private all<T extends Row>(query: string, ...bindings: SqlStorageValue[]): T[] {
    return this.sql.exec(query, ...bindings).toArray() as T[];
  }

  private one<T extends Row>(query: string, ...bindings: SqlStorageValue[]): T | null {
    return (this.sql.exec(query, ...bindings).toArray()[0] as T | undefined) ?? null;
  }

  private exists(): boolean {
    return this.one("SELECT 1 AS x FROM sqlite_master WHERE type = 'table' AND name = 'room'") !== null;
  }

  private room(): RoomRow {
    const row = this.exists() ? this.one<RoomRow>('SELECT * FROM room WHERE id = 1') : null;
    if (!row) throw new Reject(404, 'room_not_found', 'Room code not found');
    return row;
  }

  private openRoom(): RoomRow {
    const room = this.room();
    if (room.status !== 'open') throw new Reject(410, 'room_closed', 'Room is closed');
    return room;
  }

  private members(): MemberRow[] {
    return this.all<MemberRow>('SELECT * FROM members ORDER BY seat');
  }

  private member(guestId: string): MemberRow {
    const row = this.one<MemberRow>('SELECT * FROM members WHERE guest_id = ?', guestId);
    if (!row) throw new Reject(403, 'not_a_member', 'Join this room first');
    return row;
  }

  private latestGame(): GameRow | null {
    return this.one<GameRow>('SELECT * FROM games ORDER BY cycle DESC LIMIT 1');
  }

  /** The game the room is currently inside, if any. */
  private currentGame(): GameRow | null {
    const game = this.latestGame();
    if (!game || game.status === 'ended' || game.dismissed) return null;
    return game;
  }

  private writersOf(gameId: string): WriterRow[] {
    return this.all<WriterRow>('SELECT * FROM writers WHERE game_id = ? ORDER BY seat', gameId);
  }

  private poemsOf(gameId: string): PoemRow[] {
    return this.all<PoemRow>('SELECT * FROM poems WHERE game_id = ? ORDER BY ord', gameId);
  }

  // ───────────────────────── presence ─────────────────────────

  private socketCount(guestId: string, excluding?: WebSocket): number {
    let count = 0;
    for (const ws of this.ctx.getWebSockets(guestId)) {
      if (ws !== excluding && ws.readyState === WebSocket.READY_STATE_OPEN) count++;
    }
    return count;
  }

  private presenceOf(member: MemberRow, now: number, excluding?: WebSocket): Presence {
    if (member.left_at !== null) return 'away';
    if (this.socketCount(member.guest_id, excluding) > 0) return 'present';
    if (now < member.lease_until) return 'present';
    const droppedAt = Math.max(member.dropped_at, member.lease_until);
    return now - droppedAt < GRACE_MS ? 'reconnecting' : 'away';
  }

  /** An authenticated HTTP call from a player without a live socket renews their presence lease. */
  private touch(guestId: string, now: number): void {
    if (this.socketCount(guestId) > 0) return;
    this.sql.exec('UPDATE members SET lease_until = ? WHERE guest_id = ? AND left_at IS NULL', now + LEASE_MS, guestId);
  }

  /**
   * When the host is away (or gone), authority passes to the longest-seated
   * present member. A reconnecting host keeps it, and a returning former host
   * gets nothing back: authority only ever moves away from an absent host.
   */
  private ensureHost(now: number, excluding?: WebSocket): void {
    const room = this.room();
    const members = this.members();
    const host = members.find((m) => m.guest_id === room.host_id);
    if (host && this.presenceOf(host, now, excluding) !== 'away') return;
    const successor = members.find((m) => this.presenceOf(m, now, excluding) === 'present');
    if (successor && successor.guest_id !== room.host_id) {
      this.sql.exec('UPDATE room SET host_id = ? WHERE id = 1', successor.guest_id);
    }
  }

  private presenceSignature(now: number, excluding?: WebSocket): string {
    return this.members()
      .map((m) => `${m.seat}${this.presenceOf(m, now, excluding)[0]}`)
      .join('');
  }

  // ───────────────────────── commit, broadcast, alarm ─────────────────────────

  /** Every accepted change ends here: settle host authority, bump the version, tell every socket. */
  private commit(now: number, excluding?: WebSocket, activity = true): void {
    this.ensureHost(now, excluding);
    this.sql.exec(
      'UPDATE room SET version = version + 1, presence_sig = ?, last_activity_at = ? WHERE id = 1',
      this.presenceSignature(now, excluding),
      // A player doing something is activity; time passing or a socket dropping is not.
      activity ? now : this.room().last_activity_at
    );
    this.broadcast(now, excluding);
    this.schedule(now, excluding);
  }

  /** Presence can change with time alone; when it has, every screen is told. */
  private settlePresence(now: number, excluding?: WebSocket, activity = true): void {
    if (this.presenceSignature(now, excluding) !== this.room().presence_sig) this.commit(now, excluding, activity);
    else this.schedule(now, excluding);
  }

  private broadcast(now: number, excluding?: WebSocket): void {
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === excluding || ws.readyState !== WebSocket.READY_STATE_OPEN) continue;
      const attachment = ws.deserializeAttachment() as { guestId: string } | null;
      if (!attachment) continue;
      const member = this.one<MemberRow>('SELECT * FROM members WHERE guest_id = ?', attachment.guestId);
      if (!member) {
        ws.close(4403, 'left');
        continue;
      }
      ws.send(JSON.stringify({ type: 'state', state: this.view(attachment.guestId, now, excluding) }));
    }
  }

  private schedule(now: number, excluding?: WebSocket): void {
    const room = this.room();
    const times: number[] = [];
    for (const m of this.members()) {
      if (m.left_at !== null || this.socketCount(m.guest_id, excluding) > 0) continue;
      if (m.lease_until > now) times.push(m.lease_until);
      const away = Math.max(m.dropped_at, m.lease_until) + GRACE_MS;
      if (away > now) times.push(away);
    }
    const game = this.latestGame();
    if (game && game.archived_at === null && (game.status === 'reading' || game.status === 'complete')) {
      times.push(now + ARCHIVE_RETRY_MS);
    }
    for (const g of this.all<GameRow>("SELECT * FROM games WHERE status = 'ended'")) {
      const hasLines = this.one(
        'SELECT 1 AS x FROM lines l JOIN poems p ON p.id = l.poem_id WHERE p.game_id = ? LIMIT 1',
        g.id
      );
      if (hasLines) times.push((g.ended_at ?? now) + ABANDONED_RETENTION_MS);
    }
    if (game?.status === 'writing') times.push(room.last_activity_at + ABANDONED_RETENTION_MS);
    times.push(room.last_activity_at + IDLE_ROOM_RETENTION_MS);
    const next = Math.max(Math.min(...times), now + 50);
    void this.ctx.storage.setAlarm(next);
  }

  override async alarm(): Promise<void> {
    if (!this.exists()) return;
    const now = Date.now();
    const room = this.room();

    // Idle room: nobody has touched it for 90 days. Remove it and release the code.
    if (now - room.last_activity_at >= IDLE_ROOM_RETENTION_MS) {
      for (const ws of this.ctx.getWebSockets()) ws.close(4410, 'closed');
      await this.ctx.storage.deleteAlarm();
      await this.ctx.storage.deleteAll();
      return;
    }

    // Abandoned work: a writing game nobody touched for 7 days ends unpublished…
    const game = this.latestGame();
    if (game?.status === 'writing' && now - room.last_activity_at >= ABANDONED_RETENTION_MS) {
      this.sql.exec("UPDATE games SET status = 'ended', ended_at = ? WHERE id = ?", room.last_activity_at, game.id);
    }
    // …and partial lines of ended games are deleted 7 days after the end.
    for (const g of this.all<GameRow>("SELECT * FROM games WHERE status = 'ended'")) {
      if (now - (g.ended_at ?? now) >= ABANDONED_RETENTION_MS) {
        this.sql.exec('DELETE FROM lines WHERE poem_id IN (SELECT id FROM poems WHERE game_id = ?)', g.id);
      }
    }

    await this.archivePending();

    // Presence transitions (lease lapse, reconnecting → away) and host succession.
    if (this.presenceSignature(now) !== this.room().presence_sig || this.latestGame()?.status !== game?.status) {
      this.commit(now, undefined, false);
    } else {
      this.schedule(now);
    }
  }

  // ───────────────────────── views ─────────────────────────

  private phase(room: RoomRow, game: GameRow | null): Phase {
    if (room.status === 'closed') return 'closed';
    if (!game) return 'lobby';
    return game.status as Phase;
  }

  private view(guestId: string, now: number, excluding?: WebSocket): RoomView {
    const room = this.room();
    const members = this.members();
    const me = members.find((m) => m.guest_id === guestId);
    if (!me) throw new Reject(403, 'not_a_member', 'Join this room first');
    const presence = new Map<string, Presence>(members.map((m) => [m.guest_id, this.presenceOf(m, now, excluding)]));
    const game = this.currentGame();
    const isHost = room.host_id === guestId;

    const memberViews: MemberView[] = members
      .filter((m) => m.left_at === null)
      .map((m) => ({
        seat: m.seat,
        penName: m.pen_name,
        emblem: m.emblem,
        isHost: m.guest_id === room.host_id,
        isYou: m.guest_id === guestId,
        presence: presence.get(m.guest_id)!,
      }));

    let startBlocker: RoomView['startBlocker'] = null;
    if (!isHost) startBlocker = 'not_host';
    else if (game && game.status !== 'complete') startBlocker = 'game_active';
    else if (memberViews.filter((m) => m.presence === 'present').length < MIN_PLAYERS) startBlocker = 'need_players';

    return {
      code: room.code,
      version: room.version,
      phase: this.phase(room, game),
      capacity: ROOM_CAPACITY,
      you: { seat: me.seat, penName: me.pen_name, emblem: me.emblem, isHost },
      members: memberViews,
      startBlocker,
      game: game && room.status === 'open' ? this.gameView(game, guestId, isHost, presence) : null,
    };
  }

  private gameView(game: GameRow, guestId: string, isHost: boolean, presence: Map<string, Presence>): GameView {
    const writers = this.writersOf(game.id);
    const me = writers.find((w) => w.guest_id === guestId) ?? null;
    const poems = this.poemsOf(game.id);
    const round = Math.min(game.round, ROUNDS - 1);

    const submittedBy = new Set<string>();
    if (game.status === 'writing') {
      for (const row of this.all<{ author_id: string }>(
        'SELECT l.author_id FROM lines l JOIN poems p ON p.id = l.poem_id WHERE p.game_id = ? AND l.idx = ?',
        game.id,
        round
      )) {
        submittedBy.add(row.author_id);
      }
    }

    return {
      id: game.id,
      cycle: game.cycle,
      status: game.status as GameView['status'],
      round,
      role: me ? 'writer' : 'spectator',
      writers: writers.map((w) => ({
        seat: w.seat,
        penName: w.pen_name,
        emblem: w.emblem,
        isYou: w.guest_id === guestId,
        presence: presence.get(w.guest_id) ?? 'away',
        submitted: game.status !== 'writing' || submittedBy.has(w.guest_id),
      })),
      assignment: me && game.status === 'writing' ? this.assignmentFor(game, me, writers.length, poems) : null,
      circle: game.status === 'writing' ? null : this.circleView(game, guestId, me, isHost, writers, poems, presence),
    };
  }

  /** The one place a writer's limited view is built: the target, and only the immediately preceding line. */
  private assignmentFor(game: GameRow, me: WriterRow, writerCount: number, poems: PoemRow[]): AssignmentView {
    const poem = poems[poemForSeat(me.seat, game.round, writerCount)]!;
    const previous =
      game.round === 0
        ? null
        : (this.one<LineRow>('SELECT * FROM lines WHERE poem_id = ? AND idx = ?', poem.id, game.round - 1)?.text ??
          null);
    const mine = this.one<LineRow>('SELECT * FROM lines WHERE poem_id = ? AND idx = ?', poem.id, game.round);
    return {
      poemId: poem.id,
      lineIndex: game.round,
      words: ROUND_WORDS[game.round]!,
      previous,
      submitted: mine?.text ?? null,
    };
  }

  private mayReveal(
    poem: PoemRow,
    me: WriterRow | null,
    writers: WriterRow[],
    presence: Map<string, Presence>
  ): boolean {
    if (!me) return false;
    const reader = writers[poem.reader_seat]!;
    if (reader.guest_id === me.guest_id) return true;
    // The assigned reader has authority while present. If they are not, any
    // participant who is here (the host included) can step in.
    return presence.get(reader.guest_id) !== 'present';
  }

  private circleView(
    game: GameRow,
    guestId: string,
    me: WriterRow | null,
    _isHost: boolean,
    writers: WriterRow[],
    poems: PoemRow[],
    presence: Map<string, Presence>
  ): CircleView {
    const next = poems.find((p) => p.revealed_at === null) ?? null;
    const revealed = poems.filter((p) => p.revealed_at !== null);
    const current = revealed[revealed.length - 1] ?? null;
    const writerIds = new Set(writers.map((w) => w.guest_id));
    const hearts = new Map<string, string[]>();
    for (const row of this.all<{ poem_id: string; guest_id: string }>(
      'SELECT h.poem_id, h.guest_id FROM hearts h JOIN poems p ON p.id = h.poem_id WHERE p.game_id = ?',
      game.id
    )) {
      if (!writerIds.has(row.guest_id)) continue;
      hearts.set(row.poem_id, [...(hearts.get(row.poem_id) ?? []), row.guest_id]);
    }

    const views = poems.map((p) => {
      const reader = writers[p.reader_seat]!;
      const isRevealed = p.revealed_at !== null;
      return {
        id: p.id,
        ord: p.ord,
        readerName: reader.pen_name,
        readerIsYou: reader.guest_id === guestId,
        state: (p.id === current?.id ? 'reading' : isRevealed ? 'read' : p.id === next?.id ? 'next' : 'waiting') as
          'read' | 'reading' | 'next' | 'waiting',
        // Hidden text never leaves this object: lines exist in a view only after reveal.
        lines: isRevealed
          ? this.all<LineRow>('SELECT * FROM lines WHERE poem_id = ? ORDER BY idx', p.id).map((l) => ({
              text: l.text,
              by: l.author_name,
            }))
          : null,
        hearts: isRevealed ? (hearts.get(p.id)?.length ?? 0) : 0,
        hearted: isRevealed && me !== null && (hearts.get(p.id)?.includes(guestId) ?? false),
      };
    });

    let mostHeartedPoemId: string | null = null;
    if (game.status === 'complete') {
      let best = 0;
      for (const v of views) {
        if (v.hearts > best) {
          best = v.hearts;
          mostHeartedPoemId = v.id;
        }
      }
    }

    return {
      poems: views,
      nextPoemId: next?.id ?? null,
      nextReaderName: next ? writers[next.reader_seat]!.pen_name : null,
      canReveal: next !== null && this.mayReveal(next, me, writers, presence),
      mostHeartedPoemId,
    };
  }

  // ───────────────────────── entry ─────────────────────────

  private entry(input: Entry): { penName: string; emblem: Emblem } {
    const penName = typeof input.penName === 'string' ? normalizePenName(input.penName) : '';
    if (!penName) throw new Reject(422, 'pen_name_required', 'Enter a pen name');
    if (penName.length > MAX_PEN_NAME_CHARS) {
      throw new Reject(422, 'pen_name_too_long', `Use ${MAX_PEN_NAME_CHARS} characters or fewer`);
    }
    if (!isEmblem(input.emblem)) throw new Reject(422, 'invalid_emblem', 'Choose an emblem');
    return { penName, emblem: input.emblem };
  }

  create(input: Entry & { code: string }): Result<RoomView> {
    return attempt(() => {
      const { penName, emblem } = this.entry(input);
      if (this.exists() && this.one('SELECT 1 AS x FROM room')) {
        throw new Reject(409, 'code_taken', 'Room code is taken');
      }
      const now = Date.now();
      this.ctx.storage.transactionSync(() => {
        this.sql.exec(SCHEMA);
        this.sql.exec(
          "INSERT INTO room (id, code, status, host_id, version, presence_sig, created_at, last_activity_at) VALUES (1, ?, 'open', ?, 0, '', ?, ?)",
          input.code,
          input.guestId,
          now,
          now
        );
        this.sql.exec(
          'INSERT INTO members (guest_id, seat, pen_name, emblem, joined_at, left_at, lease_until, dropped_at) VALUES (?, 0, ?, ?, ?, NULL, ?, 0)',
          input.guestId,
          penName,
          emblem,
          now,
          now + LEASE_MS
        );
      });
      this.commit(now);
      measure('game_created');
      return this.view(input.guestId, now);
    });
  }

  join(input: Entry): Result<RoomView> {
    const result = attempt(() => {
      const { penName, emblem } = this.entry(input);
      this.openRoom();
      const now = Date.now();
      const existing = this.one<MemberRow>('SELECT * FROM members WHERE guest_id = ?', input.guestId);
      if (existing) {
        // The same verified identity reuses its seat.
        this.sql.exec(
          'UPDATE members SET pen_name = ?, emblem = ?, left_at = NULL, lease_until = ? WHERE guest_id = ?',
          penName,
          emblem,
          this.socketCount(input.guestId) > 0 ? existing.lease_until : now + LEASE_MS,
          input.guestId
        );
      } else {
        const count = this.one<{ n: number }>('SELECT COUNT(*) AS n FROM members')!.n;
        if (count >= ROOM_CAPACITY) throw new Reject(409, 'room_full', 'Room is full');
        const seat = this.one<{ n: number }>('SELECT COALESCE(MAX(seat), -1) + 1 AS n FROM members')!.n;
        this.sql.exec(
          'INSERT INTO members (guest_id, seat, pen_name, emblem, joined_at, left_at, lease_until, dropped_at) VALUES (?, ?, ?, ?, ?, NULL, ?, 0)',
          input.guestId,
          seat,
          penName,
          emblem,
          now,
          now + LEASE_MS
        );
      }
      this.commit(now);
      return this.view(input.guestId, now);
    });
    if (result.ok) measure('game_joined');
    else measure('join_rejected', { reason: result.code });
    return result;
  }

  /** `since` supports the HTTP fallback: an unchanged room answers null. */
  state(input: { guestId: string; since?: number | null }): Result<RoomView | null> {
    return attempt(() => {
      this.room();
      this.member(input.guestId);
      const now = Date.now();
      this.touch(input.guestId, now);
      this.settlePresence(now);
      const view = this.view(input.guestId, now);
      return input.since === view.version ? null : view;
    });
  }

  leave(input: { guestId: string }): Result<{ left: true }> {
    return attempt(() => {
      this.room();
      const member = this.one<MemberRow>('SELECT * FROM members WHERE guest_id = ?', input.guestId);
      if (!member) return { left: true as const };
      const now = Date.now();
      const game = this.currentGame();
      const writing =
        game !== null &&
        game.status !== 'complete' &&
        this.writersOf(game.id).some((w) => w.guest_id === input.guestId);
      if (writing) {
        // A frozen writer keeps their place in the game; nothing is fabricated for them.
        this.sql.exec(
          'UPDATE members SET left_at = ?, lease_until = 0, dropped_at = 0 WHERE guest_id = ?',
          now,
          input.guestId
        );
      } else {
        this.sql.exec('DELETE FROM members WHERE guest_id = ?', input.guestId);
      }
      for (const ws of this.ctx.getWebSockets(input.guestId)) ws.close(4403, 'left');
      this.commit(now);
      return { left: true as const };
    });
  }

  // ───────────────────────── game ─────────────────────────

  private requireHost(room: RoomRow, guestId: string): void {
    this.member(guestId);
    if (room.host_id !== guestId) throw new Reject(403, 'not_host', 'Only the host can do this');
  }

  start(input: { guestId: string }): Result<RoomView> {
    return attempt(() => {
      const room = this.openRoom();
      this.requireHost(room, input.guestId);
      const now = Date.now();
      this.touch(input.guestId, now);
      const current = this.currentGame();
      // A single-threaded object and one synchronous check: concurrent starts cannot overlap.
      if (current && current.status !== 'complete') {
        throw new Reject(409, 'game_active', 'A game is already running');
      }
      const members = this.members().filter((m) => m.left_at === null);
      const presence = new Map(members.map((m) => [m.guest_id, this.presenceOf(m, now)]));
      if (members.filter((m) => presence.get(m.guest_id) === 'present').length < MIN_PLAYERS) {
        throw new Reject(409, 'need_players', `Need ${MIN_PLAYERS} players`);
      }
      const writers = shuffle(members.filter((m) => presence.get(m.guest_id) !== 'away'));
      const cycle = (this.latestGame()?.cycle ?? 0) + 1;
      const gameId = randomId('g');
      this.ctx.storage.transactionSync(() => {
        this.sql.exec('DELETE FROM members WHERE left_at IS NOT NULL');
        this.sql.exec(
          "INSERT INTO games (id, cycle, status, round, started_at) VALUES (?, ?, 'writing', 0, ?)",
          gameId,
          cycle,
          now
        );
        writers.forEach((w, seat) => {
          this.sql.exec(
            'INSERT INTO writers (game_id, seat, guest_id, pen_name, emblem) VALUES (?, ?, ?, ?, ?)',
            gameId,
            seat,
            w.guest_id,
            w.pen_name,
            w.emblem
          );
          this.sql.exec(
            'INSERT INTO poems (id, game_id, ord, reader_seat) VALUES (?, ?, ?, ?)',
            randomId('p'),
            gameId,
            seat,
            readerSeat(seat, writers.length)
          );
        });
      });
      this.commit(now);
      measure('game_started', { writers: writers.length });
      return this.view(input.guestId, now);
    });
  }

  assignment(input: {
    guestId: string;
  }): Result<{ phase: Phase; round: number | null; assignment: AssignmentView | null }> {
    return attempt(() => {
      this.room();
      this.member(input.guestId);
      const now = Date.now();
      this.touch(input.guestId, now);
      this.settlePresence(now);
      const view = this.view(input.guestId, now);
      return {
        phase: view.phase,
        round: view.game ? view.game.round : null,
        assignment: view.game?.assignment ?? null,
      };
    });
  }

  async submit(input: {
    guestId: string;
    poemId: unknown;
    lineIndex: unknown;
    text: unknown;
  }): Promise<Result<SubmitResult>> {
    return attemptAsync(async () => {
      this.openRoom();
      this.member(input.guestId);
      const { poemId, lineIndex, text } = input;
      if (
        typeof poemId !== 'string' ||
        typeof lineIndex !== 'number' ||
        !Number.isInteger(lineIndex) ||
        typeof text !== 'string'
      ) {
        throw new Reject(400, 'bad_request', 'Expected poemId, lineIndex and text');
      }
      const now = Date.now();
      this.touch(input.guestId, now);
      const poem = this.one<PoemRow>('SELECT * FROM poems WHERE id = ?', poemId);
      if (!poem) throw new Reject(403, 'not_your_assignment', 'Not your line to write');
      const game = this.one<GameRow>('SELECT * FROM games WHERE id = ?', poem.game_id)!;
      if (game.status === 'ended') throw new Reject(409, 'game_ended', 'This game has ended');
      const writers = this.writersOf(game.id);
      const me = writers.find((w) => w.guest_id === input.guestId);
      if (!me) throw new Reject(403, 'not_a_writer', 'Spectators cannot submit');

      // An accepted line is immutable. Retrying the same assignment returns the
      // stored line — on every round, the last included — and never a second one.
      const stored = this.one<LineRow>('SELECT * FROM lines WHERE poem_id = ? AND idx = ?', poemId, lineIndex);
      if (stored) {
        if (stored.author_id !== input.guestId) throw new Reject(403, 'not_your_assignment', 'Not your line to write');
        await this.archivePending();
        this.settlePresence(now);
        return { poemId, lineIndex, text: stored.text, created: false };
      }

      if (game.status !== 'writing' || lineIndex < 0 || lineIndex >= ROUNDS) {
        throw new Reject(409, 'not_writing', 'Nothing to write right now');
      }
      if (lineIndex > game.round) throw new Reject(409, 'future_round', 'That round has not started');
      if (lineIndex < game.round || poem.ord !== poemForSeat(me.seat, game.round, writers.length)) {
        throw new Reject(403, 'not_your_assignment', 'Not your line to write');
      }
      const problem = checkLine(text, game.round);
      if (problem) throw new Reject(422, problem.code, problem.message);

      const member = this.member(input.guestId);
      let completed = false;
      this.ctx.storage.transactionSync(() => {
        this.sql.exec(
          'INSERT INTO lines (poem_id, idx, text, author_id, author_name, created_at) VALUES (?, ?, ?, ?, ?, ?)',
          poemId,
          lineIndex,
          normalizeLine(text),
          input.guestId,
          member.pen_name,
          now
        );
        // The next round begins only when every assigned line of this one is accepted.
        const accepted = this.one<{ n: number }>(
          'SELECT COUNT(*) AS n FROM lines l JOIN poems p ON p.id = l.poem_id WHERE p.game_id = ? AND l.idx = ?',
          game.id,
          game.round
        )!.n;
        if (accepted === writers.length) {
          if (game.round === ROUNDS - 1) {
            this.sql.exec("UPDATE games SET status = 'reading', completed_at = ? WHERE id = ?", now, game.id);
            completed = true;
          } else {
            this.sql.exec('UPDATE games SET round = round + 1 WHERE id = ?', game.id);
          }
        }
      });
      measure('line_submitted', { round: game.round + 1 });
      if (completed) {
        measure('game_completed', { writers: writers.length });
        await this.archivePending();
      }
      this.commit(now);
      return { poemId, lineIndex, text: normalizeLine(text), created: true };
    });
  }

  /** Hand a completed game to the archive. Idempotent on both sides; retried by retry and by alarm. */
  private async archivePending(): Promise<void> {
    const game = this.latestGame();
    if (!game || game.archived_at !== null || (game.status !== 'reading' && game.status !== 'complete')) return;
    const room = this.room();
    const writers = this.writersOf(game.id);
    const poems = this.poemsOf(game.id).map((p) => ({
      id: p.id,
      ord: p.ord,
      readerName: writers[p.reader_seat]!.pen_name,
      revealedAt: p.revealed_at,
      lines: this.all<LineRow>('SELECT * FROM lines WHERE poem_id = ? ORDER BY idx', p.id).map((l) => ({
        idx: l.idx,
        text: l.text,
        authorName: l.author_name,
      })),
    }));
    await this.env.ARCHIVE.get(this.env.ARCHIVE.idFromName('archive')).archiveGame({
      gameId: game.id,
      roomCode: room.code,
      completedAt: game.completed_at ?? Date.now(),
      participants: writers.map((w) => w.guest_id),
      writers: writers.map((w) => w.pen_name),
      poems,
    });
    this.sql.exec('UPDATE games SET archived_at = ? WHERE id = ?', Date.now(), game.id);
  }

  async reveal(input: { guestId: string; poemId: unknown }): Promise<Result<RoomView>> {
    return attemptAsync(async () => {
      this.openRoom();
      this.member(input.guestId);
      const now = Date.now();
      this.touch(input.guestId, now);
      const game = this.currentGame();
      if (!game || game.status === 'writing') throw new Reject(409, 'not_reading', 'Nothing to reveal yet');
      const poems = this.poemsOf(game.id);
      const poem = poems.find((p) => p.id === input.poemId);
      if (!poem) throw new Reject(404, 'poem_not_found', 'Poem not found');
      const writers = this.writersOf(game.id);
      const me = writers.find((w) => w.guest_id === input.guestId) ?? null;
      if (!me) throw new Reject(403, 'not_a_writer', 'Spectators cannot reveal');
      // Repeating a reveal is harmless.
      if (poem.revealed_at === null) {
        const next = poems.find((p) => p.revealed_at === null)!;
        if (next.id !== poem.id) throw new Reject(409, 'not_next', 'Another poem is up next');
        const presence = new Map(this.members().map((m) => [m.guest_id, this.presenceOf(m, now)]));
        if (!this.mayReveal(poem, me, writers, presence)) {
          throw new Reject(403, 'reader_present', `${writers[poem.reader_seat]!.pen_name} is reading`);
        }
        await this.archivePending();
        await this.env.ARCHIVE.get(this.env.ARCHIVE.idFromName('archive')).markRevealed({ poemId: poem.id, at: now });
        this.sql.exec('UPDATE poems SET revealed_at = ? WHERE id = ?', now, poem.id);
        if (poems.every((p) => p.id === poem.id || p.revealed_at !== null)) {
          this.sql.exec("UPDATE games SET status = 'complete' WHERE id = ?", game.id);
        }
        this.commit(now);
      }
      return this.view(input.guestId, now);
    });
  }

  /** The host ends a stalled game: back to the lobby, nothing published, nothing archived. */
  endGame(input: { guestId: string }): Result<RoomView> {
    return attempt(() => {
      const room = this.openRoom();
      this.requireHost(room, input.guestId);
      const now = Date.now();
      const game = this.currentGame();
      if (!game || game.status !== 'writing') throw new Reject(409, 'not_writing', 'No game is being written');
      this.sql.exec("UPDATE games SET status = 'ended', ended_at = ? WHERE id = ?", now, game.id);
      this.sql.exec('DELETE FROM members WHERE left_at IS NOT NULL');
      this.commit(now);
      measure('game_ended');
      return this.view(input.guestId, now);
    });
  }

  /** After the reading circle, the host can return the room to its lobby. Poems stay archived. */
  toLobby(input: { guestId: string }): Result<RoomView> {
    return attempt(() => {
      const room = this.openRoom();
      this.requireHost(room, input.guestId);
      const now = Date.now();
      const game = this.currentGame();
      if (!game || game.status !== 'complete')
        throw new Reject(409, 'not_complete', 'The reading circle is not finished');
      this.sql.exec('UPDATE games SET dismissed = 1 WHERE id = ?', game.id);
      this.sql.exec('DELETE FROM members WHERE left_at IS NOT NULL');
      this.commit(now);
      return this.view(input.guestId, now);
    });
  }

  close(input: { guestId: string }): Result<{ closed: true }> {
    return attempt(() => {
      const room = this.openRoom();
      this.requireHost(room, input.guestId);
      const game = this.currentGame();
      if (game && game.status !== 'complete') {
        throw new Reject(409, 'game_active', 'End the game before closing the room');
      }
      const now = Date.now();
      this.sql.exec("UPDATE room SET status = 'closed' WHERE id = 1");
      this.commit(now);
      for (const ws of this.ctx.getWebSockets()) ws.close(4410, 'closed');
      return { closed: true as const };
    });
  }

  /** The archive owns hearts; it tells the room so every screen shows the same count. */
  heartsChanged(input: { poemId: string; guestIds: string[] }): void {
    if (!this.exists()) return;
    const poem = this.one<PoemRow>('SELECT * FROM poems WHERE id = ?', input.poemId);
    if (!poem) return;
    this.ctx.storage.transactionSync(() => {
      this.sql.exec('DELETE FROM hearts WHERE poem_id = ?', input.poemId);
      for (const guestId of input.guestIds) {
        this.sql.exec('INSERT OR IGNORE INTO hearts (poem_id, guest_id) VALUES (?, ?)', input.poemId, guestId);
      }
    });
    this.commit(Date.now());
  }

  // ───────────────────────── WebSocket (hibernation API) ─────────────────────────

  override async fetch(request: Request): Promise<Response> {
    const guestId = request.headers.get('x-linejam-guest');
    if (request.headers.get('upgrade') !== 'websocket' || !guestId) {
      return new Response('Expected a WebSocket', { status: 426 });
    }
    const admitted = attempt(() => {
      this.room();
      this.member(guestId);
    });
    if (!admitted.ok) {
      return new Response(JSON.stringify({ error: { code: admitted.code, message: admitted.message } }), {
        status: admitted.status,
        headers: { 'content-type': 'application/json' },
      });
    }
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.ctx.acceptWebSocket(server, [guestId]);
    server.serializeAttachment({ guestId });
    const now = Date.now();
    // A new socket is a presence change for everyone else, and the newcomer needs the state.
    if (this.presenceSignature(now) !== this.room().presence_sig) this.commit(now, undefined, false);
    else server.send(JSON.stringify({ type: 'state', state: this.view(guestId, now) }));
    return new Response(null, { status: 101, webSocket: client });
  }

  override webSocketMessage(): void {
    // Clients send only the auto-answered `ping`. Every action is an HTTP call.
  }

  override webSocketClose(ws: WebSocket, code: number): void {
    this.dropped(ws);
    try {
      ws.close(code === 1005 || code === 1006 ? 1000 : code, 'closed');
    } catch {
      // Already closed.
    }
  }

  override webSocketError(ws: WebSocket): void {
    this.dropped(ws);
  }

  private dropped(ws: WebSocket): void {
    if (!this.exists()) return;
    const attachment = ws.deserializeAttachment() as { guestId: string } | null;
    if (!attachment) return;
    const now = Date.now();
    if (this.socketCount(attachment.guestId, ws) === 0) {
      this.sql.exec(
        'UPDATE members SET dropped_at = ?, lease_until = MIN(lease_until, ?) WHERE guest_id = ?',
        now,
        now,
        attachment.guestId
      );
    }
    this.settlePresence(now, ws, false);
  }
}
