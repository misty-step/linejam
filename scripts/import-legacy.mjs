// Operator import of pre-recompile data into the archive ([L1-5.4]).
//
//   node scripts/import-legacy.mjs <export-dir> --url <worker-url> [--dry-run]
//   (the operator key is read from LINEJAM_ADMIN_KEY; it is never an argument)
//
// <export-dir> holds one JSONL file per legacy table — users, games, poems,
// lines, favorites, shares — in the Convex snapshot document shape (`_id`,
// `_creationTime`, fields). That is what both a Convex snapshot export and the
// legacy backend's paged `admin/export` contain.
//
// Only completed games become archive entries: abandoned and in-progress games
// are never imported. Identifiers are preserved, so `/poem/<id>?share=<slug>`
// links published before the recompile keep working. The import is
// idempotent; re-running it adds nothing and overwrites nothing.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

function table(dir, name) {
  const file = join(dir, `${name}.jsonl`);
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

/** Legacy users were guests (`guestId`) or accounts (`clerkUserId`). */
function principal(user) {
  if (!user) return null;
  if (user.guestId) return user.guestId;
  // Accounts are not connected in the recompile; the participation is kept
  // under a namespaced principal so nothing is dropped and nothing is guessable.
  if (user.clerkUserId) return `account:${user.clerkUserId}`;
  return null;
}

/** Pure conversion: legacy tables → archive batches. Exported for tests. */
export function convert(tables) {
  const users = new Map(tables.users.map((u) => [u._id, u]));
  const linesByPoem = new Map();
  for (const line of tables.lines) {
    linesByPoem.set(line.poemId, [...(linesByPoem.get(line.poemId) ?? []), line]);
  }
  const poemsByGame = new Map();
  for (const poem of tables.poems) {
    poemsByGame.set(poem.gameId, [...(poemsByGame.get(poem.gameId) ?? []), poem]);
  }

  const games = [];
  const archivedPoems = new Set();
  const skipped = { notCompleted: 0, incompletePoems: 0 };
  for (const game of tables.games) {
    if (game.status !== 'COMPLETED' || game.completionKind === 'abandoned') {
      skipped.notCompleted++;
      continue;
    }
    const poems = (poemsByGame.get(game._id) ?? []).sort((a, b) => a.indexInRoom - b.indexInRoom);
    const whole = poems.every((p) => (linesByPoem.get(p._id) ?? []).length === 9);
    if (poems.length === 0 || !whole) {
      // A "completed" game without nine lines per poem is not presented as poems.
      skipped.incompletePoems++;
      continue;
    }
    const participants = new Set();
    const writers = new Map();
    const converted = poems.map((poem, ord) => {
      const lines = linesByPoem.get(poem._id).sort((a, b) => a.indexInPoem - b.indexInPoem);
      for (const line of lines) {
        const author = users.get(line.authorUserId);
        const id = principal(author);
        if (id) participants.add(id);
        // The byline is the pen name captured at write time.
        writers.set(line.authorUserId, line.authorDisplayName ?? author?.displayName ?? 'Unknown');
      }
      archivedPoems.add(poem._id);
      const reader = users.get(poem.assignedReaderId);
      return {
        id: poem._id,
        ord,
        readerName: writers.get(poem.assignedReaderId) ?? reader?.displayName ?? '',
        revealedAt: poem.revealedAt ?? null,
        lines: lines.map((l) => ({
          idx: l.indexInPoem,
          text: l.text,
          authorName: l.authorDisplayName ?? users.get(l.authorUserId)?.displayName ?? 'Unknown',
        })),
      };
    });
    games.push({
      gameId: game._id,
      roomCode: null,
      completedAt: game.completedAt ?? game._creationTime,
      participants: [...participants],
      writers: [...new Set(writers.values())],
      poems: converted,
    });
  }

  const favorites = [];
  for (const favorite of tables.favorites) {
    const id = principal(users.get(favorite.userId));
    if (id && archivedPoems.has(favorite.poemId)) {
      favorites.push({ guestId: id, poemId: favorite.poemId, createdAt: favorite.createdAt ?? favorite._creationTime });
    }
  }

  // Published links: a slug authorizes `/poem/<id>?share=<slug>`; a poem that
  // was public without a slug keeps its bare `/poem/<id>` link (token: null).
  const shares = [];
  const slugged = new Set();
  for (const share of tables.shares) {
    const poemId = share.poemId;
    if (!share.slug || !archivedPoems.has(poemId) || share.active === false || share.revokedAt) continue;
    slugged.add(poemId);
    shares.push({
      kind: 'poem',
      targetId: poemId,
      token: share.slug,
      createdBy: principal(users.get(share.userId)) ?? 'legacy',
      activatedAt: share.activatedAt ?? share._creationTime,
    });
  }
  for (const poem of tables.poems) {
    if (poem.publicShareEnabled === true && archivedPoems.has(poem._id) && !slugged.has(poem._id)) {
      shares.push({
        kind: 'poem',
        targetId: poem._id,
        token: null,
        createdBy: 'legacy',
        activatedAt: poem.publicShareEnabledAt ?? poem._creationTime,
      });
    }
  }
  for (const game of tables.games) {
    if (game.publicRecapEnabled === true && games.some((g) => g.gameId === game._id)) {
      shares.push({
        kind: 'recap',
        targetId: game._id,
        token: null,
        createdBy: 'legacy',
        activatedAt: game.publicRecapEnabledAt ?? game._creationTime,
      });
    }
  }
  return { games, favorites, shares, skipped };
}

export function readTables(dir) {
  return Object.fromEntries(
    ['users', 'games', 'poems', 'lines', 'favorites', 'shares'].map((name) => [name, table(dir, name)])
  );
}

async function main() {
  const args = process.argv.slice(2);
  const dir = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--url');
  const url = args.includes('--url') ? args[args.indexOf('--url') + 1] : null;
  const dryRun = args.includes('--dry-run');
  if (!dir || (!url && !dryRun)) {
    console.error('usage: node scripts/import-legacy.mjs <export-dir> --url <worker-url> [--dry-run]');
    process.exit(2);
  }
  const batch = convert(readTables(dir));
  const plan = {
    games: batch.games.length,
    poems: batch.games.reduce((n, g) => n + g.poems.length, 0),
    favorites: batch.favorites.length,
    shares: batch.shares.length,
    skipped: batch.skipped,
  };
  if (dryRun) {
    console.log(JSON.stringify({ dryRun: true, plan }, null, 2));
    return;
  }
  const key = process.env.LINEJAM_ADMIN_KEY;
  if (!key) throw new Error('LINEJAM_ADMIN_KEY is not set');
  const imported = { games: 0, poems: 0, favorites: 0, shares: 0 };
  const post = async (body) => {
    const response = await fetch(`${url.replace(/\/+$/, '')}/api/admin/import`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`import refused: HTTP ${response.status} ${await response.text()}`);
    const counts = await response.json();
    for (const name of Object.keys(imported)) imported[name] += counts[name];
  };
  // Games first (in pages), then what refers to them.
  for (let i = 0; i < batch.games.length; i += 50) await post({ games: batch.games.slice(i, i + 50) });
  for (let i = 0; i < batch.favorites.length; i += 500) await post({ favorites: batch.favorites.slice(i, i + 500) });
  for (let i = 0; i < batch.shares.length; i += 500) await post({ shares: batch.shares.slice(i, i + 500) });
  console.log(JSON.stringify({ plan, imported }, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
