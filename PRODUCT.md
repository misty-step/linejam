# Linejam — Product

## Product truth

Linejam ([linejam.mistystep.io](https://linejam.mistystep.io/)) is a
phone-first pass-the-poem party game for two to eight friends together in the
same room: each person writes one line while seeing only the line before it,
then the room reads the finished poems aloud. It needs no install and no
account, and it has no ads, no AI-generated lines and no competitive player
rankings.

## How to read this document

- This is the Active Folio: the present-tense statement of what Linejam is and
  must do. Every requirement carries a stable ID (`[L1-n]` for a capability,
  `[L1-n.m]` for a testable rule inside it). Changes to the product start here.
- [`SPEC.md`](SPEC.md) keeps the detailed observable acceptance for the
  journeys below; where it agrees with this document it remains authoritative
  detail, and where it describes the legacy runtime this document wins.
- [`DESIGN.md`](DESIGN.md), together with the locked canonical files under
  `folio/assets/` (manifest
  [`folio/assets/checksums.json`](folio/assets/checksums.json)), owns visual
  identity, typography, palette, cast emblems and component craft (see
  `[L1-7.1]`).
- Every owner decision in this document is ratified. There are no open holds.

## Vocabulary

- **Room:** a gathering with one invitation code; it can host repeated games.
- **Game:** one complete nine-round session in a room.
- **Poem:** nine accepted lines joined by the game's assignments.
- **Writer:** a player frozen into the current game when it starts.
- **Spectator:** a room member who arrived after the game started.
- **Pen name and emblem:** how a person appears to the room (the emblem is the
  player's avatar); never a credential.
- **Reading circle:** the ordered reveal of complete poems with assigned readers.

---

## [L1-1] Core nine-round pass-the-poem loop

- **[L1-1.1]** Every game has exactly nine rounds with word counts
  `1, 2, 3, 4, 5, 4, 3, 2, 1`. There are no alternate shapes, modes or
  generated writers.
- **[L1-1.2]** A game freezes its writers at start and creates exactly one poem
  per writer. Each round assigns each writer one line on one poem, and the
  assignments pass poems around the room between rounds. Players never choose
  whose poem they write on.
- **[L1-1.3]** Round 1 shows no preceding line. Rounds 2–9 show only the
  immediately preceding line of the assigned poem — never earlier lines,
  never the unfinished poem.
- **[L1-1.4]** A word is a nonempty whitespace-separated group. Punctuation
  attached to a word stays part of that word. Leading and trailing whitespace is
  ignored, and pasted tabs or newlines collapse to single spaces.
- **[L1-1.5]** A line longer than 500 characters, or with a word count other than
  the round's target, is rejected with a visible reason. A submission for
  another writer's assignment, a future round or an ended game is rejected.
- **[L1-1.6]** An accepted line is immutable. Retrying the same assignment
  returns the stored line instead of replacing it or adding a second line,
  including on the final round. A stale client settles against the stored text.
- **[L1-1.7]** The next round begins only when every assigned line of the
  current round is accepted. No line is ever fabricated for an absent writer.
- **[L1-1.8]** A game completes only when all nine lines of every poem are
  accepted; completion opens the reading circle (`[L1-3]`).

## [L1-2] Guest-first entry, rooms, invitations and presence

### Entry and identity

- **[L1-2.1]** A person enters with a pen name and a chosen cast emblem (their
  avatar, one of the eight in `DESIGN.md` `[D1-2]`); no account is required. Pen
  names are trimmed and must be nonblank. A random supported emblem is
  preselected and can be changed before submitting. Duplicate emblems are
  allowed.
- **[L1-2.2]** The roster shows each player's pen name and emblem, marks the
  host distinctly, and never relies on the emblem alone to tell people apart.
- **[L1-2.3]** Guest identity is a signed server-issued credential. It survives
  refresh and reconnect while the browser session remains valid. Session setup
  or renewal failure shows recovery instead of silently creating a different
  writer.
- **[L1-2.4]** Unsubmitted drafts survive refresh in the same browser session and
  are scoped to the verified identity that wrote them; they never transfer to a
  different guest or a newly signed-in account.
- **[L1-2.5]** Accounts are optional. When accounts are connected, signing in
  links the guest's history, room seats and host authority to the account
  without duplicating anything. When accounts are not connected, account pages
  say so instead of pretending sign-in works, and guests can still play.

### Rooms and invitations

- **[L1-2.6]** A room code is 4 characters drawn from the alphabet
  `23456789ABCDEFGHJKLMNPQRSTUVWXYZ` (no `0`, `1`, `O` or `I`). Typed codes are
  uppercased and stripped of separators.
- **[L1-2.7]** The invitation offers tap-to-copy on the code, a shareable join
  link (native share with a copy fallback), and a scannable high-contrast QR
  code with a proper quiet zone. The join link prefills the code, never the
  pen name. Copy or share failure offers retry and never claims success.
- **[L1-2.8]** Each screen has exactly one invitation area. An invitation admits
  people to the room; it never publishes a poem.
- **[L1-2.9]** Room capacity is 8. Unknown, closed or full rooms return a visible
  error instead of a phantom seat; a ninth person is refused. Rejoining with the
  same verified identity reuses the seat.

### Starting, late arrivals and presence

- **[L1-2.10]** Only the host can start a game, and only with at least 2 present
  players. With one player the start control says another is needed;
  non-hosts see that they are waiting for the host.
- **[L1-2.11]** Concurrent start attempts never create overlapping games.
- **[L1-2.12]** A late arrival joins an active game cleanly as a spectator: no
  retroactive assignment, no effect on round progress. They write normally in
  the next game. Spectators never receive hidden poem text and never see reveal,
  submit or artifact controls.
- **[L1-2.13]** Presence distinguishes writing, submitted, reconnecting and away.
  A temporary disconnect never creates a second seat.
- **[L1-2.14]** When the host leaves, the room passes host authority to a present
  player. A returning former host does not take authority back by refreshing.
- **[L1-2.15]** The host can end a stalled game, which returns everyone to the
  lobby without publishing or archiving partial poems. The host can close an
  idle room; closing is refused while a game is active, and a closed room
  rejects new arrivals. Each destructive action asks for confirmation with a
  clear safe exit.

## [L1-3] Writing, calm waiting and reading-circle reveal

### Writing

- **[L1-3.1]** The composer shows round progress (`n of 9`), the exact target word
  count, a live word count, and the preceding line when one exists (`[L1-1.3]`).
- **[L1-3.2]** Submitting gives immediate pending feedback, then an acknowledgement
  only after the server accepts the line. Rejections and uncertain submits show
  recovery without losing the draft.
- **[L1-3.10]** Submit state (`submitLine`) is scoped to one assignment,
  `(gameId, lineIndex)`. A line still settling from one round never blocks the
  next: under rapid concurrent submissions across a round transition, an Enter
  keypress on the next round's line is never dropped.

### Waiting

- **[L1-3.3]** Waiting is a calm pause. It shows who has submitted without leaking
  any text, without ranking or ordering players by speed, and without hurrying
  anyone. Nothing is auto-submitted.
- **[L1-3.4]** The writing pause is timer-free: there is no countdown, no hurry
  timer or fuse of any kind, no auto-submit and nothing that hurries a player.
  The round advances only by `[L1-1.7]`.

### Reveal and reading circle

- **[L1-3.5]** Completion opens a reading circle with an assigned reader and a
  reading order. Each entry is marked `reading now`, `up next` or `read`, and
  the room announces the next reader.
- **[L1-3.6]** Opening a poem shows the whole nine-line poem together, cleanly,
  with write-time bylines on every line. There is no forced line-by-line
  trickle or entrance flourish that withholds lines; any opening transition
  respects `prefers-reduced-motion` (`[L1-7.4]`). A line keeps the pen name used
  when it was written.
- **[L1-3.7]** The assigned reader has reveal authority. If that reader is absent,
  a present host or eligible participant can step in. Repeating a reveal is
  harmless.
- **[L1-3.8]** After all poems are revealed, the recap offers replay, play again
  and back to lobby. A new game never overwrites earlier poems.
- **[L1-3.9]** Appreciation is poem-level only: a personal heart on a whole poem.
  There are no per-line reactions, per-line rankings or player leaderboards. The
  recap may highlight the most-hearted poem, with ties broken by poem order and
  nothing highlighted when there are no hearts. It appreciates poems; it never
  ranks players.
- **[L1-3.11]** An action footer with no available action is not rendered. A
  signed-out reader of a shared poem sees the poem and its bylines only — no
  empty footer, rule or leftover spacing.

## [L1-4] Private archive and explicit, reversible sharing

- **[L1-4.1]** Completed poems are private by default and readable only by their
  participants. A room code, pen name, poem identifier or inactive share URL
  alone never authorizes a private read or another person's action.
- **[L1-4.2]** The archive lists completed poems the current person wrote on, with
  loading, empty and recovery states, favorites first and then newest. Ended or
  abandoned games never appear in the archive, recaps or any share surface.
- **[L1-4.3]** Saving a favorite, copying text and exporting an image are private
  actions that never change public visibility.
- **[L1-4.4]** Publishing a share link is a separate, explicit action available
  only for a completed, revealed poem. The control discloses
  `"Anyone with this link can read this poem"` before publication.
- **[L1-4.5]** A share link becomes public only after the copy or native share
  completes; cancellation, clipboard failure or a 30-second timeout leaves it
  inactive, and a late completion cannot override a newer one.
- **[L1-4.6]** Sharing is reversible. The owner can revoke a link and share again
  later. Revocation stops future reads; it cannot recall copies already taken.
- **[L1-4.7]** Public pages, link previews and social images apply the same access
  decision as the poem itself; a private poem resolves to a not-found page and
  never leaks a line through metadata.
- **[L1-4.8]** Publishing a full-session recap is its own explicit choice, offered
  only after every poem is revealed, and is independent of per-poem links.
- **[L1-4.9]** Retention is bounded: private completed work becomes eligible for
  cleanup after 90 days and abandoned work after 7 days; public or favorited
  poems are protected while that protection applies, with a 30-day grace period
  after it is removed.
- **[L1-4.10]** Product measurement is anonymous. Analytics and error reports never
  contain names, emails, account IDs, guest credentials, room codes, poem text,
  query strings or location enrichment, and an unavailable analytics or error
  sink never blocks play.

## [L1-5] Clean-room recompile and runtime simplicity

- **[L1-5.1]** Linejam is recompiled cleanly for
  [https://linejam.mistystep.io/](https://linejam.mistystep.io/). The legacy
  multi-runtime stack — Next.js on OpenNext, Convex, the Rust/WASM crates
  (including `crates/entry-ui`) and the Dagger multi-runtime pipeline — is
  retired and replaced by one lean, self-contained runtime with a single
  authoritative owner of real-time room state.
- **[L1-5.2]** The single target runtime is **Cloudflare Workers with Durable
  Objects (SQLite storage)**:
  - each room is one Durable Object whose embedded SQLite database is the
    authoritative state for that room;
  - live room updates reach every client in real time over WebSockets, using
    Durable Object WebSocket hibernation;
  - the Worker serves the static UI assets directly; there is no separate
    frontend server or framework runtime.
- **[L1-5.3]** The application builds, runs and passes its end-to-end
  verification in a fresh, disposable sandbox with zero cloud credentials, using
  local `wrangler` / Miniflare. Local verification uses generated identities and
  refuses production credentials.
- **[L1-5.4]** The recompile preserves every rule in `[L1-1]`–`[L1-4]` and
  `[L1-6]`–`[L1-7]`. Existing guest credentials, accepted poems, published links
  and archives are migrated or honored; no player data is invented, reset or
  silently dropped.
- **[L1-5.5]** The web release feeds described by legacy `SPEC.md` `US-004`
  (`/changelog`, `/releases` and `/releases.xml`) are retired in the clean-room
  Worker. Release history lives in GitHub Releases.

## [L1-6] CLI and MCP parity

- **[L1-6.1]** Scripted players have a command-line interface and an MCP server
  covering guest bootstrap (MCP's `mint-guest` action), room creation and
  joining, room state, game start, assignment reads, line submission,
  completed-poem reads and favorites.
- **[L1-6.2]** Both interfaces obey exactly the same identity, membership,
  word-count and privacy rules as the browser. There are no privileged
  automation shortcuts.
- **[L1-6.3]** The CLI prints successful results as JSON on stdout and exits zero;
  rejections print a structured failure on stderr with empty stdout and a
  nonzero exit. Minted guest credentials go to stderr and are never part of
  shareable output.
- **[L1-6.4]** MCP supports initialization, tool discovery and calls. A rejected
  game action is a tool error; a malformed request is a protocol error.
  Discovery alone creates nothing.

## [L1-7] Craft, zero narrator copy, universal subtle motion and accessibility

### Visual identity authority

- **[L1-7.1]** The locked visual identity is **Contemporary Warm Salon / Tactile
  Stationery**. [`DESIGN.md`](DESIGN.md) owns it — typography, palette, color
  modes, cast emblems, motion and component craft — together with the canonical
  files under `folio/assets/`, whose exact bytes are pinned by the SHA-256
  manifest [`folio/assets/checksums.json`](folio/assets/checksums.json). This
  explicitly supersedes the lavender / DynaPuff identity freeze recorded in
  legacy `project.md`.

### Zero narrator copy

- **[L1-7.2]** Every string passes the **Delete Test** (removing it loses nothing
  the player needs) and the **Self-Reference Test** (it never narrates the
  interface or explains an obvious mechanic). Forbidden patterns include
  "the only line you get to see", "click below to…", and subtitles that
  paraphrase their heading.

### Universal subtle motion

- **[L1-7.3]** Every action, loading, waiting and error state, and screen
  transition moves deliberately using the single motion token set in
  `DESIGN.md` `[D1-6]` (`90ms` tap, `160ms` micro feedback, `220ms` screens),
  animating only `transform`, `opacity` and color, and never delays input.
- **[L1-7.4]** Under `prefers-reduced-motion: reduce`, every motion has a complete
  static or crossfade fallback, and no information depends on motion.

### Accessibility and modes

- **[L1-7.5]** Layouts are phone-first and fully usable at `320px` and `390px`
  wide, with the virtual keyboard open and at `200%` text, with `0px`
  horizontal overflow.
- **[L1-7.6]** Touch targets are at least `44px`; input text is at least `16px`.
- **[L1-7.7]** Every flow is operable by keyboard and screen reader. Icon-only
  controls have accessible names, dialogs trap and return focus, and Escape
  closes them.
- **[L1-7.8]** Light, Dark and System color modes are available; System follows the
  OS and the explicit choice persists.
- **[L1-7.9]** Optional Cuelume / WebAudio cues play only after a trusted user
  gesture, on deliberate actions and confirmed results. A muted preference
  persists. Sound never replaces visible feedback, and unavailable audio never
  blocks play.

## [L1-8] Production observability and automated incident triage

Observability is zero-SDK and privacy-preserving, with zero external browser
requests.

### Worker observability

- **[L1-8.1]** Cloudflare Workers Observability stays enabled
  (`observability.enabled = true` in `wrangler.jsonc`). The Worker emits
  structured, anonymous operational logs — never names, guest tokens, room
  codes, share tokens or poem text.

### Server and browser error capture to Sentry

- **[L1-8.2]** The browser loads no third-party SDK and makes no request to
  another origin. `connect-src 'self'` stays strict.
- **[L1-8.3]** The browser UI captures uncaught `error`, `unhandledrejection` and
  `securitypolicyviolation` events and posts a scrubbed diagnostic beacon to
  same-origin `POST /api/telemetry/error`.
- **[L1-8.4]** The Worker forwards unhandled server and Durable Object exceptions
  (`5xx`) and rate-limited, scrubbed browser error beacons to Sentry. Forwarding
  is asynchronous (`ctx.waitUntil`) and uses a lean, zero-dependency Sentry
  Envelope HTTP `POST`. It is active whenever `SENTRY_DSN` or
  `NEXT_PUBLIC_SENTRY_DSN` is bound.
- **[L1-8.5]** Every forwarded event is tagged with `environment`, `release` (the
  deployed commit/version identity returned by `/api/health`) and one error
  kind: `worker_exception`, `browser_error`, `unhandled_rejection` or
  `csp_violation`.

### Privacy and secret gate

- **[L1-8.6]** Payloads are scrubbed before they leave the Worker: no query
  strings, share slugs, room codes, guest cookies or tokens, or poem lines. The
  limits in `[L1-4.10]` apply to every forwarded event.
- **[L1-8.7]** With no DSN secret configured (local development and tests),
  forwarding is a clean no-op and no request fails because of it.

### Health and release identity

- **[L1-8.8]** `GET /api/health` returns
  `{ status: "ok", environment, release, sentryConfigured }`, where
  `sentryConfigured` is a boolean. It never exposes a secret value or a DSN
  string. Live gates and uptime checks use it to verify the deployed version
  and the observability wiring deterministically.

### Auto-triage readiness

- **[L1-8.9]** Production alerts from the Sentry project `linejam` route
  automatically to Misty Step's Sentry Auto-Triage pipeline (`supercortex`
  `tools/sentry-triage`).

## Not Linejam

- No required accounts, ads, social-network identity or growth mechanics.
- No AI-generated or fabricated lines, extra game modes or ornamental prompts.
- No competitive player rankings, leaderboards, per-line rankings, scores,
  streaks, countdowns or hurry pressure.
- No web release feeds: legacy `SPEC.md` `US-004` (`/changelog`, `/releases`,
  `/releases.xml`) is retired in the clean-room Worker; release history lives in
  GitHub Releases.
- No second runtime: no Next.js, OpenNext, Convex, Rust/WASM or Dagger
  multi-runtime layer alongside the Worker.
- No hidden poem text in spectator views, metadata, images or previews.

---

## Verification and acceptance bar

A change is accepted only when it is verified on the real running application,
not by tests or a green CI run alone.

- **[V-1]** A headed browser walkthrough at `1440×900` and `390×844`, in Light,
  Dark and `prefers-reduced-motion: reduce`, completes a real multi-player cycle:
  create room → join from a second player → write all nine rounds → reading
  circle reveal → private save → public share → revoke.
- **[V-2]** That walkthrough records `0` console errors, `0` CSP violations,
  `0` failed network requests and `0px` horizontal overflow, and confirms that
  no hidden text reaches a spectator.
- **[V-3]** The full verification runs in a fresh, disposable sandbox with no
  cloud credentials (`[L1-5.3]`).
- **[V-4]** After deploy, a live gate on
  [https://linejam.mistystep.io/](https://linejam.mistystep.io/) confirms the
  serving revision and a real player entry journey. `GET /api/health` reports
  the deployed `release` and `sentryConfigured: true` (`[L1-8.8]`).
