import { DurableObject } from 'cloudflare:workers';
import type {
  ArchiveEntry,
  FavoriteEntry,
  PoemLine,
  PoemView,
  RecapView,
  ShareAttempt,
} from '../shared/types.ts';
import type { Env } from './env.ts';
import { Reject, attempt, attemptAsync, type Result } from './http.ts';
import { measure } from './measure.ts';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Private completed work becomes eligible for cleanup after 90 days. */
export const PRIVATE_RETENTION_MS = 90 * DAY_MS;
/** Once a poem is no longer public or favorited, it keeps a 30-day grace period. */
export const PROTECTION_GRACE_MS = 30 * DAY_MS;
/** A share link that is not confirmed within 30 seconds stays inactive. */
export const SHARE_PENDING_MS = 30_000;
const SWEEP_INTERVAL_MS = DAY_MS;
const ARCHIVE_WINDOW = 200;

type Row = Record<string, SqlStorageValue>;
export type ShareKind = 'poem' | 'recap';

interface PoemRow extends Row {
  id: string;
  game_id: string;
  ord: number;
  reader_name: string;
  completed_at: number;
  revealed_at: number | null;
  unprotected_at: number | null;
}

interface GameRow extends Row {
  id: string;
  room_code: string | null;
  completed_at: number;
  writers_json: string;
}

interface ShareRow extends Row {
  token: string;
  kind: ShareKind;
  target_id: string;
  created_by: string;
  status: 'pending' | 'active' | 'cancelled' | 'revoked' | 'expired';
  open: number;
  created_at: number;
  expires_at: number | null;
}

export interface ArchiveGameInput {
  gameId: string;
  roomCode: string | null;
  completedAt: number;
  participants: string[];
  writers: string[];
  poems: {
    id: string;
    ord: number;
    readerName: string;
    revealedAt: number | null;
    lines: { idx: number; text: string; authorName: string }[];
  }[];
}

export interface LegacyBatch {
  games?: ArchiveGameInput[];
  favorites?: { guestId: string; poemId: string; createdAt: number }[];
  shares?: { kind: ShareKind; targetId: string; token: string | null; createdBy: string; activatedAt: number }[];
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  room_code TEXT,
  completed_at INTEGER NOT NULL,
  writers_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS poems (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL,
  ord INTEGER NOT NULL,
  reader_name TEXT NOT NULL,
  completed_at INTEGER NOT NULL,
  revealed_at INTEGER,
  unprotected_at INTEGER
);
CREATE INDEX IF NOT EXISTS poems_by_game ON poems (game_id, ord);
CREATE TABLE IF NOT EXISTS lines (
  poem_id TEXT NOT NULL,
  idx INTEGER NOT NULL,
  text TEXT NOT NULL,
  author_name TEXT NOT NULL,
  PRIMARY KEY (poem_id, idx)
);
CREATE TABLE IF NOT EXISTS participants (
  game_id TEXT NOT NULL,
  guest_id TEXT NOT NULL,
  PRIMARY KEY (game_id, guest_id)
);
CREATE INDEX IF NOT EXISTS participants_by_guest ON participants (guest_id);
CREATE TABLE IF NOT EXISTS favorites (
  guest_id TEXT NOT NULL,
  poem_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (guest_id, poem_id)
);
CREATE INDEX IF NOT EXISTS favorites_by_poem ON favorites (poem_id);
CREATE TABLE IF NOT EXISTS shares (
  token TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  target_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  status TEXT NOT NULL,
  open INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  expires_at INTEGER,
  activated_at INTEGER,
  ended_at INTEGER
);
CREATE INDEX IF NOT EXISTS shares_by_target ON shares (kind, target_id, created_at);
`;

function shareToken(): string {
  const raw = crypto.getRandomValues(new Uint8Array(24));
  let binary = '';
  for (const b of raw) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function sharePath(kind: ShareKind, targetId: string, token: string): string {
  return `/${kind}/${encodeURIComponent(targetId)}?share=${encodeURIComponent(token)}`;
}

/**
 * Completed poems, who may read them, favorites, share links and retention.
 * This object's SQLite database is the only authority for all of it. A poem
 * is private until a participant confirms a share link, and private again the
 * moment that link is revoked.
 */
export class ArchiveDO extends DurableObject<Env> {
  private readonly sql: SqlStorage;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(SCHEMA);
  }

  private all<T extends Row>(query: string, ...bindings: SqlStorageValue[]): T[] {
    return this.sql.exec(query, ...bindings).toArray() as T[];
  }

  private one<T extends Row>(query: string, ...bindings: SqlStorageValue[]): T | null {
    return (this.sql.exec(query, ...bindings).toArray()[0] as T | undefined) ?? null;
  }

  // ───────────────────────── access ─────────────────────────

  private isParticipant(gameId: string, guestId: string | null): boolean {
    if (!guestId) return false;
    return this.one('SELECT 1 AS x FROM participants WHERE game_id = ? AND guest_id = ?', gameId, guestId) !== null;
  }

  private activeShare(kind: ShareKind, targetId: string): ShareRow | null {
    return this.one<ShareRow>(
      "SELECT * FROM shares WHERE kind = ? AND target_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1",
      kind,
      targetId
    );
  }

  /**
   * The single public-read decision. A supplied link authorizes only itself:
   * an unknown, pending, expired or revoked token never falls back to some
   * other link. With no token, only a link imported as an open legacy
   * publication (the pre-recompile `/poem/<id>` form) authorizes a read.
   */
  private shareAuthorizes(kind: ShareKind, targetId: string, token: string | null | undefined): boolean {
    if (token) {
      const row = this.one<ShareRow>('SELECT * FROM shares WHERE token = ?', token);
      return row !== null && row.kind === kind && row.target_id === targetId && row.status === 'active';
    }
    return (
      this.one("SELECT 1 AS x FROM shares WHERE kind = ? AND target_id = ? AND status = 'active' AND open = 1", kind, targetId) !==
      null
    );
  }

  private poemRow(poemId: unknown): PoemRow {
    const row = typeof poemId === 'string' ? this.one<PoemRow>('SELECT * FROM poems WHERE id = ?', poemId) : null;
    // One answer for "does not exist" and "not yours": an identifier alone reveals nothing.
    if (!row) throw new Reject(404, 'poem_not_found', 'Poem not found');
    return row;
  }

  private participantPoem(poemId: unknown, guestId: string): PoemRow {
    const poem = this.poemRow(poemId);
    if (!this.isParticipant(poem.game_id, guestId)) throw new Reject(404, 'poem_not_found', 'Poem not found');
    return poem;
  }

  private linesOf(poemId: string): PoemLine[] {
    return this.all<{ text: string; author_name: string }>(
      'SELECT text, author_name FROM lines WHERE poem_id = ? ORDER BY idx',
      poemId
    ).map((l) => ({ text: l.text, by: l.author_name }));
  }

  private hearts(poemId: string): number {
    return this.one<{ n: number }>('SELECT COUNT(*) AS n FROM favorites WHERE poem_id = ?', poemId)!.n;
  }

  // ───────────────────────── intake from rooms ─────────────────────────

  private insertGame(input: ArchiveGameInput): void {
    this.sql.exec(
      'INSERT OR IGNORE INTO games (id, room_code, completed_at, writers_json) VALUES (?, ?, ?, ?)',
      input.gameId,
      input.roomCode,
      input.completedAt,
      JSON.stringify(input.writers)
    );
    for (const guestId of input.participants) {
      this.sql.exec('INSERT OR IGNORE INTO participants (game_id, guest_id) VALUES (?, ?)', input.gameId, guestId);
    }
    for (const poem of input.poems) {
      this.sql.exec(
        'INSERT OR IGNORE INTO poems (id, game_id, ord, reader_name, completed_at, revealed_at) VALUES (?, ?, ?, ?, ?, ?)',
        poem.id,
        input.gameId,
        poem.ord,
        poem.readerName,
        input.completedAt,
        poem.revealedAt
      );
      for (const line of poem.lines) {
        this.sql.exec(
          'INSERT OR IGNORE INTO lines (poem_id, idx, text, author_name) VALUES (?, ?, ?, ?)',
          poem.id,
          line.idx,
          line.text,
          line.authorName
        );
      }
    }
  }

  /** Called by a room when all nine lines of every poem are accepted. Idempotent. */
  async archiveGame(input: ArchiveGameInput): Promise<void> {
    this.ctx.storage.transactionSync(() => this.insertGame(input));
    if ((await this.ctx.storage.getAlarm()) === null) {
      await this.ctx.storage.setAlarm(Date.now() + SWEEP_INTERVAL_MS);
    }
  }

  markRevealed(input: { poemId: string; at: number }): void {
    this.sql.exec('UPDATE poems SET revealed_at = COALESCE(revealed_at, ?) WHERE id = ?', input.at, input.poemId);
  }

  // ───────────────────────── private archive ─────────────────────────

  list(input: { guestId: string }): Result<ArchiveEntry[]> {
    return attempt(() => {
      const rows = this.all<PoemRow & { writers_json: string; fav: number | null }>(
        `SELECT p.*, g.writers_json, f.created_at AS fav
           FROM participants pa
           JOIN poems p ON p.game_id = pa.game_id
           JOIN games g ON g.id = p.game_id
           LEFT JOIN favorites f ON f.poem_id = p.id AND f.guest_id = pa.guest_id
          WHERE pa.guest_id = ?
          ORDER BY (f.created_at IS NULL), p.completed_at DESC, p.ord
          LIMIT ?`,
        input.guestId,
        ARCHIVE_WINDOW
      );
      return rows.map((p) => ({
        id: p.id,
        completedAt: p.completed_at,
        firstLine: this.one<{ text: string }>('SELECT text FROM lines WHERE poem_id = ? AND idx = 0', p.id)?.text ?? '',
        writers: JSON.parse(p.writers_json) as string[],
        favorited: p.fav !== null,
        shared: this.activeShare('poem', p.id) !== null,
      }));
    });
  }

  poem(input: { guestId: string | null; poemId: string; shareToken?: string | null }): Result<PoemView> {
    return attempt(() => {
      const poem = this.poemRow(input.poemId);
      const participant = this.isParticipant(poem.game_id, input.guestId);
      // A share link is read as a share link, even by a participant: what the
      // page shows is exactly what the link authorizes.
      const allowed = input.shareToken
        ? this.shareAuthorizes('poem', poem.id, input.shareToken)
        : participant || this.shareAuthorizes('poem', poem.id, null);
      if (!allowed) throw new Reject(404, 'poem_not_found', 'Poem not found');
      const active = participant ? this.activeShare('poem', poem.id) : null;
      return {
        id: poem.id,
        gameId: participant ? poem.game_id : '',
        completedAt: poem.completed_at,
        lines: this.linesOf(poem.id),
        hearts: this.hearts(poem.id),
        favorited:
          input.guestId !== null &&
          this.one('SELECT 1 AS x FROM favorites WHERE guest_id = ? AND poem_id = ?', input.guestId, poem.id) !== null,
        participant,
        revealed: poem.revealed_at !== null,
        share: { active: active !== null, path: active ? sharePath('poem', poem.id, active.token) : null },
      };
    });
  }

  recap(input: { guestId: string | null; gameId: string; shareToken?: string | null }): Result<RecapView> {
    return attempt(() => {
      const game = this.one<GameRow>('SELECT * FROM games WHERE id = ?', input.gameId);
      const participant = game !== null && this.isParticipant(game.id, input.guestId);
      const allowed =
        game !== null &&
        (input.shareToken ? this.shareAuthorizes('recap', game.id, input.shareToken) : participant || this.shareAuthorizes('recap', game.id, null));
      if (!game || !allowed) throw new Reject(404, 'recap_not_found', 'Recap not found');
      const poems = this.all<PoemRow>('SELECT * FROM poems WHERE game_id = ? ORDER BY ord', game.id);
      const active = participant ? this.activeShare('recap', game.id) : null;
      return {
        gameId: game.id,
        completedAt: game.completed_at,
        writers: JSON.parse(game.writers_json) as string[],
        poems: poems.map((p) => ({
          id: p.id,
          ord: p.ord,
          readerName: p.reader_name,
          lines: this.linesOf(p.id),
          hearts: this.hearts(p.id),
        })),
        share: { active: active !== null, path: active ? sharePath('recap', game.id, active.token) : null },
        participant,
      };
    });
  }

  // ───────────────────────── favorites ─────────────────────────

  /**
   * A heart is a personal favorite: private, and never a publication. `on`
   * omitted toggles. Participants can favorite their poems; another reader can
   * favorite a poem only through its active share link; anyone can always
   * remove their own favorite.
   */
  async setFavorite(input: {
    guestId: string;
    poemId: string;
    on?: boolean | null;
    shareToken?: string | null;
  }): Promise<Result<{ poemId: string; favorited: boolean; hearts: number }>> {
    return attemptAsync(async () => {
      const now = Date.now();
      const existing = this.one('SELECT 1 AS x FROM favorites WHERE guest_id = ? AND poem_id = ?', input.guestId, input.poemId);
      const poem = typeof input.poemId === 'string' ? this.one<PoemRow>('SELECT * FROM poems WHERE id = ?', input.poemId) : null;
      const want = typeof input.on === 'boolean' ? input.on : existing === null;
      if (!want) {
        if (existing) {
          this.sql.exec('DELETE FROM favorites WHERE guest_id = ? AND poem_id = ?', input.guestId, input.poemId);
          if (poem) this.noteProtection(poem.id, now);
          measure('artifact_action', { action: 'unfavorite' });
        } else if (!poem) {
          throw new Reject(404, 'poem_not_found', 'Poem not found');
        }
      } else {
        const allowed =
          poem !== null &&
          (this.isParticipant(poem.game_id, input.guestId) || this.shareAuthorizes('poem', poem.id, input.shareToken ?? null));
        if (!poem || !allowed) throw new Reject(404, 'poem_not_found', 'Poem not found');
        if (!existing) {
          this.sql.exec('INSERT INTO favorites (guest_id, poem_id, created_at) VALUES (?, ?, ?)', input.guestId, poem.id, now);
          this.sql.exec('UPDATE poems SET unprotected_at = NULL WHERE id = ?', poem.id);
          measure('artifact_action', { action: 'favorite' });
        }
      }
      if (poem) await this.tellRoom(poem);
      return { poemId: input.poemId, favorited: want, hearts: poem ? this.hearts(poem.id) : 0 };
    });
  }

  private async tellRoom(poem: PoemRow): Promise<void> {
    const game = this.one<GameRow>('SELECT * FROM games WHERE id = ?', poem.game_id);
    if (!game?.room_code) return;
    const guestIds = this.all<{ guest_id: string }>('SELECT guest_id FROM favorites WHERE poem_id = ?', poem.id).map(
      (r) => r.guest_id
    );
    await this.env.ROOM.get(this.env.ROOM.idFromName(game.room_code)).heartsChanged({ poemId: poem.id, guestIds });
  }

  favorites(input: { guestId: string }): Result<FavoriteEntry[]> {
    return attempt(() =>
      this.all<{ poem_id: string; created_at: number }>(
        'SELECT poem_id, created_at FROM favorites WHERE guest_id = ? ORDER BY created_at DESC',
        input.guestId
      ).map((f) => {
        const poem = this.one<PoemRow>('SELECT * FROM poems WHERE id = ?', f.poem_id);
        const available =
          poem !== null && (this.isParticipant(poem.game_id, input.guestId) || this.activeShare('poem', poem.id) !== null);
        return {
          id: f.poem_id,
          favoritedAt: f.created_at,
          available,
          // A favorite on a poem that is private again exposes no text; it can still be removed.
          firstLine: available
            ? (this.one<{ text: string }>('SELECT text FROM lines WHERE poem_id = ? AND idx = 0', f.poem_id)?.text ?? null)
            : null,
        };
      })
    );
  }

  // ───────────────────────── sharing ─────────────────────────

  private shareTarget(kind: ShareKind, id: unknown, guestId: string): string {
    if (kind === 'poem') {
      const poem = this.participantPoem(id, guestId);
      if (poem.revealed_at === null) throw new Reject(409, 'not_revealed', 'Reveal this poem first');
      return poem.id;
    }
    const game = typeof id === 'string' ? this.one<GameRow>('SELECT * FROM games WHERE id = ?', id) : null;
    if (!game || !this.isParticipant(game.id, guestId)) throw new Reject(404, 'recap_not_found', 'Recap not found');
    const hidden = this.one('SELECT 1 AS x FROM poems WHERE game_id = ? AND revealed_at IS NULL LIMIT 1', game.id);
    if (hidden) throw new Reject(409, 'not_revealed', 'Reveal every poem first');
    return game.id;
  }

  private expirePending(now: number): void {
    this.sql.exec("UPDATE shares SET status = 'expired', ended_at = ? WHERE status = 'pending' AND expires_at < ?", now, now);
  }

  /**
   * Step one of publishing: an unpredictable link that exposes nothing yet.
   * If the target is already public, the existing link is returned to copy again.
   */
  beginShare(input: { guestId: string; kind: ShareKind; id: unknown }): Result<ShareAttempt> {
    return attempt(() => {
      const targetId = this.shareTarget(input.kind, input.id, input.guestId);
      const now = Date.now();
      this.expirePending(now);
      const active = this.activeShare(input.kind, targetId);
      if (active && !active.open) {
        return { token: active.token, path: sharePath(input.kind, targetId, active.token), active: true, expiresAt: null };
      }
      const token = shareToken();
      this.sql.exec(
        "INSERT INTO shares (token, kind, target_id, created_by, status, created_at, expires_at) VALUES (?, ?, ?, ?, 'pending', ?, ?)",
        token,
        input.kind,
        targetId,
        input.guestId,
        now,
        now + SHARE_PENDING_MS
      );
      return { token, path: sharePath(input.kind, targetId, token), active: false, expiresAt: now + SHARE_PENDING_MS };
    });
  }

  /**
   * Step two: the copy or native share completed, so the link becomes public.
   * Only the newest unexpired attempt can win; a late or stale completion
   * cannot replace or cancel a newer one.
   */
  confirmShare(input: { guestId: string; kind: ShareKind; id: unknown; token: unknown }): Result<ShareAttempt> {
    return attempt(() => {
      const targetId = this.shareTarget(input.kind, input.id, input.guestId);
      const now = Date.now();
      this.expirePending(now);
      const row = typeof input.token === 'string' ? this.one<ShareRow>('SELECT * FROM shares WHERE token = ?', input.token) : null;
      if (!row || row.kind !== input.kind || row.target_id !== targetId || row.created_by !== input.guestId) {
        throw new Reject(404, 'share_not_found', 'Share link not found');
      }
      if (row.status === 'active') {
        return { token: row.token, path: sharePath(input.kind, targetId, row.token), active: true, expiresAt: null };
      }
      if (row.status !== 'pending') throw new Reject(409, 'share_inactive', 'Link expired. Share again');
      const newer = this.one(
        "SELECT 1 AS x FROM shares WHERE kind = ? AND target_id = ? AND token != ? AND status IN ('pending', 'active') AND open = 0 AND created_at > ?",
        input.kind,
        targetId,
        row.token,
        row.created_at
      );
      if (newer) {
        this.sql.exec("UPDATE shares SET status = 'cancelled', ended_at = ? WHERE token = ?", now, row.token);
        throw new Reject(409, 'share_stale', 'Link expired. Share again');
      }
      this.ctx.storage.transactionSync(() => {
        this.sql.exec(
          "UPDATE shares SET status = 'cancelled', ended_at = ? WHERE kind = ? AND target_id = ? AND status = 'pending' AND token != ?",
          now,
          input.kind,
          targetId,
          row.token
        );
        this.sql.exec("UPDATE shares SET status = 'active', activated_at = ?, expires_at = NULL WHERE token = ?", now, row.token);
        if (input.kind === 'poem') this.sql.exec('UPDATE poems SET unprotected_at = NULL WHERE id = ?', targetId);
      });
      measure('artifact_action', { action: input.kind === 'poem' ? 'share' : 'recap_share' });
      return { token: row.token, path: sharePath(input.kind, targetId, row.token), active: true, expiresAt: null };
    });
  }

  /** Cancellation or clipboard failure: this attempt, and only this attempt, stays inactive. */
  cancelShare(input: { guestId: string; token: unknown }): Result<{ cancelled: boolean }> {
    return attempt(() => {
      const now = Date.now();
      const row = typeof input.token === 'string' ? this.one<ShareRow>('SELECT * FROM shares WHERE token = ?', input.token) : null;
      if (!row || row.created_by !== input.guestId || row.status !== 'pending') return { cancelled: false };
      this.sql.exec("UPDATE shares SET status = 'cancelled', ended_at = ? WHERE token = ?", now, row.token);
      return { cancelled: true };
    });
  }

  /** Revocation stops future reads. It cannot recall copies already taken. */
  revokeShare(input: { guestId: string; kind: ShareKind; id: unknown }): Result<{ active: false }> {
    return attempt(() => {
      let targetId: string;
      if (input.kind === 'poem') targetId = this.participantPoem(input.id, input.guestId).id;
      else {
        const game = typeof input.id === 'string' ? this.one<GameRow>('SELECT * FROM games WHERE id = ?', input.id) : null;
        if (!game || !this.isParticipant(game.id, input.guestId)) throw new Reject(404, 'recap_not_found', 'Recap not found');
        targetId = game.id;
      }
      const now = Date.now();
      this.sql.exec(
        "UPDATE shares SET status = CASE status WHEN 'active' THEN 'revoked' ELSE 'cancelled' END, ended_at = ? WHERE kind = ? AND target_id = ? AND status IN ('active', 'pending')",
        now,
        input.kind,
        targetId
      );
      if (input.kind === 'poem') this.noteProtection(targetId, now);
      measure('artifact_action', { action: input.kind === 'poem' ? 'revoke' : 'recap_revoke' });
      return { active: false as const };
    });
  }

  /** Used by the Worker so a page for an inactive link answers 404 before any HTML is sent. */
  shareIsActive(input: { kind: ShareKind; id: string; token: string | null }): boolean {
    this.expirePending(Date.now());
    return this.shareAuthorizes(input.kind, input.id, input.token);
  }

  // ───────────────────────── retention ─────────────────────────

  private isProtected(poemId: string): boolean {
    return (
      this.one('SELECT 1 AS x FROM favorites WHERE poem_id = ? LIMIT 1', poemId) !== null ||
      this.activeShare('poem', poemId) !== null
    );
  }

  /** When the last favorite or share goes, the 30-day grace period starts. */
  private noteProtection(poemId: string, now: number): void {
    if (!this.isProtected(poemId)) this.sql.exec('UPDATE poems SET unprotected_at = ? WHERE id = ?', now, poemId);
  }

  /**
   * Private completed poems are eligible 90 days after completion; a poem that
   * was public or favorited is protected while that lasts and for 30 days
   * after. Deletion runs only when RETENTION_GC_ENABLED is "1"; otherwise the
   * sweep reports what is eligible and deletes nothing.
   */
  sweep(): { eligible: number; deleted: number; dryRun: boolean } {
    const now = Date.now();
    this.expirePending(now);
    this.sql.exec("DELETE FROM shares WHERE status IN ('cancelled', 'expired') AND ended_at < ?", now - DAY_MS);
    const candidates = this.all<PoemRow>(
      'SELECT * FROM poems WHERE completed_at <= ? AND (unprotected_at IS NULL OR unprotected_at <= ?)',
      now - PRIVATE_RETENTION_MS,
      now - PROTECTION_GRACE_MS
    ).filter((p) => !this.isProtected(p.id) && this.activeShare('recap', p.game_id) === null);
    const dryRun = this.env.RETENTION_GC_ENABLED !== '1';
    if (dryRun) return { eligible: candidates.length, deleted: 0, dryRun };
    this.ctx.storage.transactionSync(() => {
      for (const p of candidates) {
        this.sql.exec('DELETE FROM lines WHERE poem_id = ?', p.id);
        this.sql.exec("DELETE FROM shares WHERE kind = 'poem' AND target_id = ?", p.id);
        this.sql.exec('DELETE FROM poems WHERE id = ?', p.id);
      }
      for (const g of this.all<{ id: string }>('SELECT id FROM games WHERE id NOT IN (SELECT DISTINCT game_id FROM poems)')) {
        this.sql.exec('DELETE FROM participants WHERE game_id = ?', g.id);
        this.sql.exec("DELETE FROM shares WHERE kind = 'recap' AND target_id = ?", g.id);
        this.sql.exec('DELETE FROM games WHERE id = ?', g.id);
      }
    });
    return { eligible: candidates.length, deleted: candidates.length, dryRun };
  }

  override async alarm(): Promise<void> {
    const report = this.sweep();
    console.log(JSON.stringify({ app: 'linejam', event: 'retention_sweep', ...report }));
    await this.ctx.storage.setAlarm(Date.now() + SWEEP_INTERVAL_MS);
  }

  // ───────────────────────── legacy import ─────────────────────────

  /**
   * Operator import of pre-recompile data (see scripts/import-legacy.mjs).
   * Idempotent: identifiers are preserved and existing rows are never
   * overwritten, so a re-run adds nothing and resets nothing.
   */
  async importLegacy(batch: LegacyBatch): Promise<{ games: number; poems: number; favorites: number; shares: number }> {
    const before = this.counts();
    this.ctx.storage.transactionSync(() => {
      for (const game of batch.games ?? []) this.insertGame(game);
      for (const f of batch.favorites ?? []) {
        this.sql.exec('INSERT OR IGNORE INTO favorites (guest_id, poem_id, created_at) VALUES (?, ?, ?)', f.guestId, f.poemId, f.createdAt);
      }
      for (const s of batch.shares ?? []) {
        this.sql.exec(
          "INSERT OR IGNORE INTO shares (token, kind, target_id, created_by, status, open, created_at, activated_at) VALUES (?, ?, ?, ?, 'active', ?, ?, ?)",
          s.token ?? `legacy-open:${s.kind}:${s.targetId}`,
          s.kind,
          s.targetId,
          s.createdBy,
          s.token ? 0 : 1,
          s.activatedAt,
          s.activatedAt
        );
      }
    });
    if ((await this.ctx.storage.getAlarm()) === null) await this.ctx.storage.setAlarm(Date.now() + SWEEP_INTERVAL_MS);
    const after = this.counts();
    return {
      games: after.games - before.games,
      poems: after.poems - before.poems,
      favorites: after.favorites - before.favorites,
      shares: after.shares - before.shares,
    };
  }

  private counts(): { games: number; poems: number; favorites: number; shares: number } {
    const n = (table: string) => this.one<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`)!.n;
    return { games: n('games'), poems: n('poems'), favorites: n('favorites'), shares: n('shares') };
  }
}
