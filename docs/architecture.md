# Architecture

One Cloudflare Worker, two Durable Object classes with SQLite storage, static
assets served by the Worker. `wrangler.jsonc` is the whole deployment contract.

```
browser ─┐                       ┌─ RoomDO (one per room code, SQLite)
CLI ─────┼─ HTTP / WebSocket ─ Worker ─┤
MCP ─────┘   (src/worker.ts)     └─ ArchiveDO (one, SQLite)
                  │
                  └─ ASSETS: dist/public (built by scripts/build.mjs)
```

## Source layout

| Path                | Owns                                                                                           |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| `shared/rules.ts`   | The game rules, once: round shape, word counting, room codes, emblems, the assignment matrix   |
| `shared/types.ts`   | The views the Worker sends; used by the Worker, the browser client, the CLI and tests          |
| `src/worker.ts`     | Routing, guest identity, security headers, pages, the retired-route 404s                       |
| `src/auth.ts`       | Signed guest credentials (HMAC-SHA256) and the cookie                                          |
| `src/room.ts`       | `RoomDO`: members, presence, host succession, games, lines, reading circle, WebSockets, alarms |
| `src/archive.ts`    | `ArchiveDO`: completed poems, participants, favorites, share links, retention, legacy import   |
| `src/measure.ts`    | Anonymous measurement: an allow-listed structured log line                                     |
| `web/`              | The browser UI: `static/` (HTML, CSS) and `src/` (TypeScript, bundled by esbuild)              |
| `cli/`              | The CLI and the MCP server over one small HTTP client                                          |
| `scripts/build.mjs` | Checksum gate and generation of everything in `dist/public`                                    |
| `e2e/`              | The headed two-player walkthrough                                                              |

## Rooms

A room code names a `RoomDO` (`idFromName(code)`). The object's SQLite database
holds `room`, `members`, `games`, `writers`, `poems`, `lines` and a mirror of
`hearts`. Every mutation is an RPC method that validates, writes in one
synchronous transaction, then _commits_: settle host authority, bump the room
version, and send each connected socket its own view.

- **Views, not state dumps.** `RoomDO.view(guestId)` builds what one person may
  see. A writer's assignment carries the target word count and only the
  immediately preceding line. Poem text enters a view only after reveal.
  Guest ids never appear in a view.
- **Assignment.** In round `r`, poem `p` is written by seat `(p + r) mod n`,
  after a random seating at game start. Each round is a permutation, no writer
  writes two consecutive lines of a poem, and with 2–8 writers everyone writes
  on every poem. The reader of a poem is the seat after the one that started it.
- **Idempotent lines.** `lines` has primary key `(poem_id, idx)`. A retry of an
  accepted assignment returns the stored text; nothing is replaced or appended.
- **Presence.** A member with an open socket is `present`. An HTTP-only player
  (CLI, MCP, polling browser) is present for 45 seconds after each call. After
  presence drops there are 15 seconds of `reconnecting`, then `away`. An alarm
  fires at each transition.
- **Host succession.** When the host is `away`, authority passes to the
  longest-seated present member. It never moves back because someone returned.
- **Real time.** WebSockets use the Durable Object hibernation API
  (`acceptWebSocket`, tagged by guest; `ping`/`pong` auto-response), so an idle
  room costs nothing and survives eviction. Clients that cannot hold a socket
  poll `GET /api/rooms/:code?v=<version>` (`204` while unchanged).
- **Cleanup.** An ended (abandoned) game's partial lines are deleted after 7
  days; a room nobody has touched for 90 days is deleted, releasing its code.

## Archive

When the last line of a game is accepted, the room hands the completed game to
`ArchiveDO` (idempotent; retried by retry and by alarm). From then on the
archive is the authority for completed poems.

- **Access.** A poem is readable by the writers of its game, or by anyone
  holding an _active_ share token for that poem. Everything else answers
  `404 poem_not_found` — a room code, pen name, poem id or dead link reveals
  nothing, not even existence.
- **Hearts** are personal favorites, stored once in the archive. The archive
  tells the poem's room so every screen shows the same count.
- **Sharing is two steps.** `POST …/share` issues an unpredictable link that
  exposes nothing. Only `POST …/share/confirm`, sent after the copy or native
  share really completed, makes it public. A pending link expires after 30
  seconds; only the newest attempt can be confirmed. `DELETE …/share` revokes.
  The page route (`/poem/:id?share=…`) asks the archive first and answers 404
  for an inactive link before any HTML is sent.
- **Retention.** A daily alarm finds poems completed more than 90 days ago that
  are neither favorited nor public, and whose protection (if any) ended more
  than 30 days ago. It deletes them only when `RETENTION_GC_ENABLED` is `"1"`;
  otherwise it reports the count and deletes nothing.

## Identity

`POST /api/guest` issues `base64url({guestId, issuedAt}) . base64url(HMAC)`,
signed with `GUEST_TOKEN_SECRET`, as an `HttpOnly; SameSite=Lax` cookie
(`linejam_guest_token`) and in the response body for the CLI and MCP, which
send it as `Authorization: Bearer`. Credentials last 7 days and renew in use.
A presented credential that fails verification is refused; the browser shows
recovery instead of silently becoming a different writer. Without the secret
the Worker refuses to issue or accept credentials (`503`).

The format, secret name and cookie name are those of the pre-recompile app, so
a valid credential issued before the recompile is still honored.

## The built UI

`scripts/build.mjs` (run by `wrangler` through `build.command`) is the only way
files reach `dist/public`:

1. verify every `folio/assets/*` SHA-256 against `checksums.json` — a mismatch
   fails the build;
2. copy those exact bytes to `/folio/*`;
3. generate `tokens.css` from `tokens.json`, and the inline-SVG module from the
   SVG file text;
4. render the raster icons from `mark.svg`;
5. copy the three self-hosted OFL font families;
6. bundle `web/src` with esbuild.

The client is plain TypeScript with a small DOM patcher (`web/src/morph.ts`):
views are HTML strings, state comes from the server, and the only client-held
state is what the player is typing.
