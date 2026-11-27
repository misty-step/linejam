# Linejam

## What it does

Linejam is a phone-first party game where two to eight people pass poems around, each writing a line while seeing only the previous one, then reveal and read the finished poems aloud.

## What it enables

Phaedrus's family and friends can make something funny and surprising together, with no account setup getting in the way of a party.

Nine rounds use 1, 2, 3, 4, 5, 4, 3, 2, 1 words. A room can host repeated games.
A pen name and emblem identify someone to the room, not to an account system.

[PRODUCT.md](PRODUCT.md) is the Active Folio: the present-tense statement of
what Linejam is and must do, with stable requirement IDs. This document keeps
the detailed observable acceptance for its journeys; where the two differ,
`PRODUCT.md` wins. Visual identity belongs to [DESIGN.md](DESIGN.md) and the
locked files in `folio/assets/`. Architecture belongs in
[docs/architecture.md](docs/architecture.md); priorities, open questions and
decisions in flight belong to Powder, not this document.

`live` means implemented in the current product and verified locally by
`pnpm verify` ([testing](docs/testing.md)); it is not a claim about any
production deployment. The three stable story IDs describe end-to-end
journeys. The [feature map](features/README.md) locates implementations.

## Capability: Guest party

### US-001 [live] Start and join a room without an account

When friends gather, I want an invitation they can open on their phones without
signing up, so everyone can join the same writing session.

Criteria:

1. WHEN a host creates a room, THE SYSTEM SHALL issue a join code and a
   guest session that survives refresh.
2. WHEN a guest presents a valid guest token for an open room, THE SYSTEM
   SHALL join them without an account.
3. IF the account service is unavailable, THEN THE SYSTEM SHALL still admit guests.

Detailed acceptance:

- Home offers starting a room and joining one. Entry requires a nonblank pen
  name and offers the eight cast emblems. A fresh entry starts with a random
  emblem selected; players can change it before submitting. Names are trimmed,
  and the room roster shows each player's chosen name and emblem, marking the
  host separately. A new room begins in its lobby.
- An invitation has a four-character code, a copy-code action, a shareable join
  link and a scannable QR code. Following the link prefills the join code, not
  the person's pen name. Typed codes are uppercased and stripped of non-letter/
  digit separators. Copy/share failure offers retry without claiming success.
  An invitation admits people; it does not publish any poems.
- Join requires a code and pen name. Unknown, closed or full rooms give a visible
  error rather than a phantom seat; capacity is eight. Rejoining with the same
  verified identity reuses the seat instead of duplicating it. A different
  browser session is a different guest, even if it uses the same pen name.
- The lobby shows the roster and player count out of eight. The host can start
  the first game with at least two eligible, present players. With one player
  the start control explains that another is needed; non-hosts wait for the
  host. Concurrent start attempts must not create overlapping games.
- Account creation is optional. Guests retain their identity through refresh
  while their browser session remains valid. Session setup or renewal failure
  shows recovery rather than silently creating an unrelated writer. During an
  identity transition, writing waits for verification of the returning person.
- Where accounts are connected, sign-in and sign-up are available. Successful
  sign-in transfers owned guest history and room participation to the account,
  including prior contributions and host authority, without duplicating them.
  A fresh guest with no history can also finish sign-in. Failed transfer offers
  retry or return home, not false completion. Profile distinguishes guest from
  signed-in status, supports sign-out, and explains cross-device access.
  In an account-free local game, account pages explain that accounts are not
  connected rather than pretending sign-in works.
- Connection and presence status distinguish waiting, reconnecting and away
  players. A temporary disconnect does not create another seat. Host succession
  preserves a usable room when the host is absent; returning does not reclaim
  authority from the newly selected host merely by refreshing. A non-host can
  leave the lobby; leaving the page is not the same as closing the room.
- Scripted players have command-line and MCP interfaces for room creation,
  joining and state; game start, assignment and line submission; completed-poem
  reads; and favorite toggling/listing. They obey the same identity, membership,
  word-count and privacy rules, not privileged automation rules. Command-line
  creation/join can mint a guest identity; MCP offers a separate mint-guest action
  and requires that identity on other calls. Subsequent actions reuse the same
  identity. The command line prints successful results as JSON on stdout with
  exit zero; rejected joins
  produce a structured failure on stderr, empty stdout and a nonzero exit.
  Implicitly minted credentials are reported separately on stderr and must not
  be treated as shareable game output. MCP supports initialization, tool discovery
  and calls; application rejection is a tool error, not a successful game action,
  while malformed requests use protocol errors. Discovery alone creates no room
  and proves no rendered player experience.

No required accounts, ads or social-network identity. A room code or a pen name
alone never authorizes private reads or another person's actions.

## Capability: Poem

### US-002 [live] Write nine lines and reveal the whole poems

When we play, I want the word-count shape and limited view to make a surprising
shared poem, with a clear reading circle at the end.

Criteria:

1. WHEN a round is assigned, THE SYSTEM SHALL show a writer only the
   preceding line and the word count for that round.
2. WHEN nine rounds complete, THE SYSTEM SHALL reveal each poem's nine
   lines together.
3. IF a player reconnects mid-game, THEN THE SYSTEM SHALL restore their
   seat without duplicating a contribution.

Detailed acceptance:

- A game freezes its participating writers, creates one poem per participant,
  and assigns each writer one line on one poem per round. Assignments vary
  between rounds to pass poems between people, rather than letting a player
  select another person's contribution. The shape is always nine rounds and
  1–2–3–4–5–4–3–2–1 words, with no selectable alternate modes or generated writers.
- Round one has no preceding line. Later rounds expose only the immediately
  preceding line of the assigned poem, never its full unfinished history. The
  composer displays round progress, the target word count, the current count and
  clear submit/waiting feedback. Other writers' progress indicates who has
  submitted without revealing their text.
- Words are nonempty whitespace-separated groups: punctuation attached to a
  word is not another word. Leading/trailing whitespace is ignored, and pasted
  tabs or newlines collapse into spaces. A line longer than 500 characters or
  with the wrong word count is rejected. Another writer's assignment, a future
  round or an abandoned game cannot accept a new contribution.
- Accepted lines are immutable. Repeated submission of the same assignment
  returns the already stored line instead of replacing it or appending a second
  contribution. Submit state is scoped to one assignment (game, line index): a
  line still settling from one round never blocks the next round's submit, so
  an Enter on the next line during a round transition is sent at once, not
  dropped (`PRODUCT.md` `[L1-3.10]`). Waiting lasts until all assigned lines in that round exist;
  only then does the next round begin. A stale client must settle against the
  stored text, not label a different unsaved draft as accepted.
- Unsubmitted drafts survive refresh in the same browser session when storage
  is available. A temporary storage failure can retain a draft in memory for
  the same verified person, but is not durable recovery across browser closure.
  Drafts must not transfer to a newly signed-in or different guest identity.
- A late arrival may join an open room during writing, but watches the current
  game rather than gaining a retroactive assignment or blocking progress. They
  join normally in the next game. Spectators cannot submit, manage artifacts,
  reveal a private assigned poem or see unrevealed poem previews.
- Completion enters a reading circle with assigned readers and reading order.
  Opening a poem shows all nine lines together with bylines, not a line-by-line
  animation or a different poem. Other room members see it after reveal.
  The order marks reading now, up next and read, and supports replaying poems.
  The assigned reader has reveal authority; if absent, a present host or eligible
  participant can step in. Participants can read their completed poems in the
  archive without depending on live presence. Repeating reveal is harmless.
- After all poems are revealed, the session recap offers replay, play again,
  back to lobby and exit. Current members can start another game from completion
  or return to the same invitation's lobby; the next game does not overwrite
  the prior poems. A host can explicitly end a stalled active game, returning
  the room to its lobby without presenting partial work as completed poems.
  Room closure is host-only and is refused while a game is active; closed
  invitations reject new arrivals. Fully abandoned sessions do not enter the
  complete-poem archive or public sharing surfaces.
- Help explains write, pass and read together, including the word-count pattern.
  Forms and game controls have accessible names and keyboard operation. Help
  traps focus, closes with Escape and returns focus to its opener; reading
  transitions announce the next reader. Phone layouts keep the composer,
  primary actions and scrollable content reachable with a virtual keyboard or
  enlarged text. Color mode can follow the system or an explicit light/dark
  choice. Reduced motion removes movement; nothing depends on it.
- Sound is available for deliberate activation and confirmed results, not hover,
  typing, disabled controls or repeated held-key events. It waits for a trusted
  interaction rather than playing on page load. Muting suppresses future sound;
  the explicit preference persists and synchronizes with same-origin tabs. Reduced motion does not itself mute sound. Sound and visual
  celebration never substitute for visible success or error feedback.

No generated player lines, extra modes, competitive player rankings or fabricated
replacement lines for an absent writer. A completed browser journey and a
reconnected seat are separate observations, not implied by a lobby screenshot.

#### Abandoned games

- A game the host ends, or a writing game nobody touches for seven days, is
  abandoned: it never enters the archive, a recap or any share surface.
- Its partial lines are deleted seven days after it ended. A room nobody has
  touched for ninety days is removed, releasing its code.
- Cleanup runs from the room's own alarm, needs no external scheduler, and
  never blocks play.

## Capability: Keep and share

### US-003 [live] Save privately and publish on purpose

When a poem is done, I want to keep or export it privately, and deliberately
choose whether people outside the game can read a poem or a session recap.

Criteria:

1. WHEN a player saves a poem, THE SYSTEM SHALL keep the text private to
   authorized viewers.
2. WHEN a player publishes, THE SYSTEM SHALL issue a reversible public
   link.
3. IF a spectator has no authorization, THEN THE SYSTEM SHALL not leak
   unpublished poem text.

Detailed acceptance:

- The archive lists completed poems the current person contributed to. It has
  loading, empty and recovery states, each poem's first line, date, writers and
  a personal favorite control. Favorites sort first, then newest poems within
  each group. The list is a bounded window, not a promise of unlimited lifetime
  history. Partial or abandoned sessions must not masquerade as poems.
- Opening an owned completed poem shows its full text and per-line bylines.
  A line keeps the pen name used when written, even if its author chooses
  another name in a later room. Public and archive bylines do not disclose
  durable account identifiers. Guests' private history belongs to that browser
  identity until an authorized account transfer.
- A heart saves a personal favorite without publishing. Participants can favorite
  private completed poems; another reader can favorite an explicitly public
  completed poem. Toggling again removes the favorite. If publication is revoked,
  an outsider's favorite no longer exposes text, but can still be removed.
  The room recap shows a live room-favorite poem and heart count; ties use poem
  order, and no favorite is crowned when there are no hearts. This is appreciation
  of poems, not a ranking of players.
- Copying poem text and saving its image are local exports, not publication.
  Private image export requires participant access. Saving or exporting alone
  must not change public visibility. A person who downloads or copies an artifact
  can retain that copy outside Linejam.
- A poem is private by default, including older poems with no publication choice.
  Share controls disclose that anyone with the link can read it. A participant
  can share only a completed, revealed poem. A fresh poem-share attempt issues
  an unpredictable pending link, which exposes no text before successful copy
  or native-share completion. Cancellation, clipboard failure or timeout leaves
  that attempt inactive. Pending attempts expire after 30 seconds; late or stale
  completions cannot cancel or replace a newer successful attempt.
- A successful poem share enables public access. The owner can revoke access
  and later share again. An unknown, expired or inactive supplied share link
  never falls back to some other public link's authorization. Public page text,
  previews and social images apply the same access decision; a private artifact
  uses a not-found fallback rather than leaking a first line through metadata.
  Revocation stops future service reads, not already fetched copies or caches.
- A full-session recap lists its poems, readers, poet count and replay controls.
  Public recap sharing is a separate explicit choice available only after all
  poems are revealed. It publishes the complete recap to anyone with its link;
  it does not require enabling each poem's individual share link. Revoking the
  recap does not implicitly revoke an independently published poem, or vice versa.
  Like a poem link, a recap link becomes public only after the copy or native
  share completes.
- Private completed poems become eligible for cleanup after 90 days, abandoned
  work after seven days. Public or favorited poems remain protected while that
  protection applies; removing protection starts a 30-day grace period.
  Eligibility is not a guaranteed deletion instant: deletion runs only where
  an operator has enabled it, and otherwise the sweep only reports.

A signed-out reader of a shared poem sees the poem and its bylines only: no
action footer, rule or spacing is rendered when no action is available
(`[L1-3.11]`).

No hidden unpublished text in spectator responses, metadata, images or previews.
Knowing a room code, poem identifier or inactive share URL is not permission.

#### Privacy-safe measurement across US-001–003

As the product owner, I want anonymous story outcomes so I can steer the
product without reading players' private work.

- The Worker records bounded, anonymous events as structured log lines:
  `game_created` and `game_joined` (US-001), `line_submitted` and
  `game_completed` (US-002), `artifact_action` (US-003), plus `join_rejected`,
  `game_started` and `game_ended`.
- An event carries only an allow-list of bounded fields: writer count, round
  number, a bounded rejection reason, an action name. Never names, emails,
  account IDs, guest credentials or ids, room codes, poem text, URLs, query
  strings or location.
- The browser loads no analytics or error SDK and makes no request to another
  origin. An unavailable log sink never prevents admission, writing, reveal,
  saving or sharing.

#### Production observability and error triage (`PRODUCT.md` `[L1-8]`)

As the operator, I want every production failure to reach Sentry tagged with
the deployed release, without any player's private data and without a browser
SDK.

- Cloudflare Workers Observability stays enabled (`wrangler.jsonc`
  `observability.enabled`). Every captured error also writes an anonymous
  `{"event":"error_captured","kind":…,"type":…}` log line.
- The browser listens for uncaught `error`, `unhandledrejection` and
  `securitypolicyviolation` and sends at most one beacon per distinct error
  (ten per page) to same-origin `POST /api/telemetry/error`, without
  credentials. The beacon carries the kind, error type, message, stack, the
  page as a route template (`/room/:id`) and, for CSP, the directive and the
  blocked origin. The route needs no guest identity; it refuses cross-origin
  posts (`403`), non-JSON (`415`), unknown kinds (`400`), bodies over 8 KiB
  (`413`), and answers `429` past 30 beacons per minute per isolate.
- The Worker forwards unhandled Worker and Durable Object exceptions (a `500`
  answer, or a failing Durable Object alarm), `5xx` refusals and accepted
  beacons to Sentry as one Envelope `POST` per event, asynchronously
  (`ctx.waitUntil`), with no SDK. Each event is tagged `environment`,
  `release` and one kind: `worker_exception`, `browser_error`,
  `unhandled_rejection` or `csp_violation`.
- Before an event leaves the Worker, every text field is scrubbed: query
  strings and fragments, path identifiers, room codes, guest cookies, bearer
  and token-shaped strings, and email addresses are removed; fields are
  length-bounded. Request bodies, names and poem lines are never part of an
  event.
- Forwarding is active when `SENTRY_DSN` (or `NEXT_PUBLIC_SENTRY_DSN`) is bound
  to a valid DSN. With none, it is a no-op and every request answers as before;
  a malformed DSN is logged as `sentry_dsn_invalid`, and a failed delivery as
  `sentry_forward_failed`, never failing the request.
- `GET /api/health` answers `{ status: "ok", environment, release,
sentryConfigured }`. `release` is the commit the Worker was built from
  (`-dirty` when built from uncommitted changes; `LINEJAM_RELEASE` names it
  explicitly). The answer never contains the DSN or any secret.
- Sentry alert routing to Misty Step's auto-triage pipeline (`[L1-8.9]`) is
  configured in Sentry, outside this repository.

#### Party-scale recovery

As friends on phones, we can keep our seats and drafts while a browser reloads,
disconnects, or sleeps. Waking restores current state before accepting more work.
Ten concurrent eight-person rooms obey the same admission, assignment, immutable
line, host-succession and privacy rules as a single room. A late eighth arrival
watches the current seven-writer game and participates in the next game. An
absent host can return as a writer without taking authority back from the
successor. A ninth person is refused, not given an invisible seat. Browser
freeze/offline emulation is recovery evidence, not physical-phone qualification.

## Retired: release administration (US-004)

The web release feeds this story described — `/changelog`, `/releases` and
`/releases.xml`, and the footer link to them — are retired
(`PRODUCT.md` `[L1-5.5]`). Those routes answer `404`. Release history lives in
[GitHub Releases](https://github.com/misty-step/linejam/releases).

#### Local verification

As a maintainer, I want one verification command on our own machines, so that
checking a candidate does not require a hosted CI vendor or production access.

- `pnpm verify --fast` checks the build (including the canonical-asset
  checksum gate), types, formatting and every test. `pnpm verify` also runs the
  rendered two-player journey in a headed browser against the real local
  Worker, including authorization rejection and share revocation.
- Verification uses generated local identities, loopback targets and throwaway
  storage, and refuses cloud credentials. It never imports, resets or migrates
  an existing deployment.
- The walkthrough also proves, in the browser, that an Enter during a round
  transition is not dropped, and that browser errors reach a loopback Sentry
  sink scrubbed and tagged.
- A failed step stops verification and returns nonzero. Output identifies the
  mode, each command and the source revision.
- Local verification is not deployment, and not the live gate on
  `linejam.mistystep.io`.

Deploying, importing pre-recompile data and enabling retention deletion are
separate, explicitly authorized operations
([operations](docs/operations.md)). Existing guest credentials, accepted poems,
published links and archives are migrated or honored; no player data is
invented, reset or silently dropped.
