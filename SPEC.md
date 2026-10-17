# Linejam

## What it does

Linejam is a phone-first party game where two to eight people pass poems around, each writing a line while seeing only the previous one, then reveal and read the finished poems aloud.

## What it enables

Phaedrus's family and friends can make something funny and surprising together, with no account setup getting in the way of a party.

Nine rounds use 1, 2, 3, 4, 5, 4, 3, 2, 1 words. A room can host repeated games.
A pen name and avatar identify someone to the room, not to an account system.

This is the reference specification for observable behavior. `live` means
implemented in the current product, not independently verified in every
production deployment. `next` and `later` are reserved for owner-approved work;
none is asserted here. Priorities, open questions and decisions in flight belong
to Powder, not this document. Architecture and technical decisions belong in
[architecture](docs/ARCHITECTURE.md) and repository ADRs; product identity belongs
in [DESIGN.md](DESIGN.md). [README.md](README.md) owns the application,
documentation and marketing links.

The four stable story IDs describe end-to-end journeys. Their numbered criteria
preserve the existing automated walk checkpoints; the detailed acceptance below
also defines the product and needs the corresponding focused checks. A walk
receipt is evidence for its observed checkpoints, not certification of every
sentence here. [Testing](docs/testing.md) owns verification procedures and gaps;
the [feature map](features/README.md) locates implementations.

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

- Home offers starting a game and joining a room. Creation requires a nonblank
  pen name and offers a choice of illustrated avatar. A fresh entry attempt
  starts with an avatar selection; players can change it before submitting.
  Names are trimmed, and the room roster shows each player's chosen name and
  avatar, marking the host separately. A new room begins in its lobby.
- An invitation has a four-character code, a copy-code action, a shareable join
  link and a scannable QR code. Following the link prefills the join code, not
  the person's pen name. Typed codes are uppercased and stripped of non-letter/
  digit separators. Copy/share failure offers retry without claiming success.
  An invitation admits people; it does not publish any poems.
- Join requires a code and pen name. Unknown, closed or full rooms give a visible
  error rather than a phantom seat; capacity is eight. Rejoining with the same
  verified identity reuses the seat instead of duplicating it. A different
  browser session is a different guest, even if it uses the same pen name.
  Retired historical invitations do not admit new players; retained poems remain
  available under their existing access rules.
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
  contribution. Waiting lasts until all assigned lines in that round exist;
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
  participant can step in. Retained game participants can reveal in a closed
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
  choice. Reduced motion suppresses unnecessary ceremony motion and haptics.
- Sound is available for deliberate activation and confirmed results, not hover,
  typing, disabled controls or repeated held-key events. It waits for a trusted
  interaction rather than playing on page load. Muting suppresses future sound
  and ceremony haptics; the explicit preference persists and synchronizes with
  same-origin tabs. Reduced motion does not itself mute sound. Sound and visual
  celebration never substitute for visible success or error feedback.

No generated player lines, extra modes, competitive player rankings or fabricated
replacement lines for an absent writer. A completed browser journey and a
reconnected seat are separate observations, not implied by a lobby screenshot.

#### Abandonment sweep health

As the operator, I want unattended-game cleanup failures and absent runs to
reach the existing owned alert intake, without stopping people from playing.

- The existing minute-by-minute sweep closes unattended games atomically per
  bounded page, preserving partial-line privacy and active participants.
- One native Sentry check-in covers an entire sweep: it starts before the first
  page, succeeds only after every continuation page commits, and fails if any
  page fails. An interrupted run must never report success.
- Sentry detects a failed, timed-out, or missed production sweep and routes the
  incident through the existing scheduled-job alert and canonical owned intake.
  A normal successful sweep recovers the monitor.
- Reporting contains only the monitor identity, environment, source release,
  generated check-in identity, status and elapsed time; no player or game data.
- Disabled or unavailable telemetry must not prevent cleanup or gameplay.
  Nonproduction runs must not seed a production monitor environment.
- Retention remains unchanged; this story does not authorize enabling deletion.

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
  loading, empty and recovery states, an emphasized first poem, poem-shape
  previews, dates, collaborator information and personal favorite controls.
  Favorites sort first, then newest poems within each group. Displayed counts
  describe the returned archive window, not a promise of unlimited lifetime
  history. Recent partial or abandoned sessions must not masquerade as poems.
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
  Unlike individual poem sharing, recap publication currently happens before
  the copy/native-share result; cancelling that sheet does not roll it back.
- Recent public-poem showcases use only explicitly public completed work, not
  private archive text. Private completed artifacts become eligible for cleanup
  after 90 days, abandoned work after seven days. Public or favorited poems
  remain protected while that protection applies; removing protection starts a
  30-day grace period. Eligibility is not a guaranteed deletion instant, and
  account identities are not treated as disposable guest history.

No hidden unpublished text in spectator responses, metadata, images or previews.
Knowing a room code, poem identifier or inactive share URL is not permission.

#### Privacy-safe measurement across US-001–003

As the product owner, I want anonymous pageviews, sessions and story outcomes
so I can steer the product without reading players' private work.

These supporting criteria apply across the three player journeys; they do not
add another end-to-end story or change their stable numbered walk checkpoints.

- A configured production browser records pageviews and sessions, including
  guest play without a signed-in account. Events carry `app=linejam`, the
  environment and source release. Unconfigured browsers send nothing.
- The existing `game_created` and `game_joined` outcomes measure US-001;
  `line_submitted` and `game_completed` measure US-002; `artifact_action`
  measures US-003. Existing supporting funnel/share signals remain available.
  A retried room/cycle/round/action is counted once per browser runtime.
- Analytics contains no names, emails, account IDs, guest tokens, room codes,
  poem text, query strings, fragments, raw private paths or IP/geolocation
  enrichment. Routes are templates. Browser identifiers are random,
  host-scoped pseudonyms, not signed-in identities. Autocapture, replay,
  surveys and automatic exception/performance capture are disabled.
- SDK exceptions and an unavailable analytics sink never prevent admission,
  writing, reveal, saving or sharing. A later user action can be captured
  after the sink recovers; failed actions are not invented or backfilled.
- Browser automation and nonproduction events are marked synthetic, so they
  can be excluded from human-usage aggregates. Anonymous browsers are not
  guaranteed to represent unique people across devices or cleared storage.
- Admission attempts and failures use bounded reason codes, never the entered
  invitation or an error message. The funnel distinguishes an attempt from a
  successful join. Starts include the number of participating writers; a first
  accepted line records elapsed time since that game started, including reloads.
  Existing stage/round outcomes permit measuring where players stop progressing.
- Browser and Worker ingress exceptions carry the serving source release and
  environment to Sentry with private content removed. An unavailable error sink
  does not stall a healthy request. Native uptime monitoring covers the health
  endpoint; each new issue, handled or unhandled, reaches the existing owned
  alert intake once on first sight rather than notifying for every occurrence.

#### Party-scale recovery

As friends on phones, we can keep our seats and drafts while a browser reloads,
disconnects, or sleeps. Waking restores current state before accepting more work.
Ten concurrent eight-person rooms obey the same admission, assignment, immutable
line, host-succession and privacy rules as a single room. A late eighth arrival
watches the current seven-writer game and participates in the next game. An
absent host can return as a writer without taking authority back from the
successor. A ninth person is refused, not given an invisible seat. Browser
freeze/offline emulation is recovery evidence, not physical-phone qualification.

## Capability: Release administration

### US-004 [live] Prepare a reviewed release when generated notes fail

When release-note generation fails, I want an explicitly technical-only candidate
for review, so that provider availability neither blocks verified changes nor
gets mistaken for a player outage.

Criteria:

1. IF the release-notes provider fails, THEN THE SYSTEM SHALL prepare a
   technical-only candidate with an explicit provider-failure status and
   deterministic technical history, without inventing notes or claiming a
   deliberate policy skip.
2. WHEN a technical-only candidate replaces an earlier candidate for the same
   version, THE SYSTEM SHALL remove stale generated notes from every release
   projection.
3. IF release evidence is malformed or generated notes fail grounding or
   integrity checks, THEN THE SYSTEM SHALL reject the candidate.
4. WHILE a candidate has not passed the existing review and CI gates, THE
   SYSTEM SHALL publish neither its tag nor its GitHub Release.
5. WHERE a release has no public notes, THE SYSTEM SHALL show its status and
   deterministic technical history, open, on `/changelog`, the site changelog,
   the feed and the GitHub Release, with consistent status in the release PR.
6. WHEN note generation fails, THE SYSTEM SHALL expose the failure as release
   administration evidence without representing it as a player outage.

Detailed acceptance:

- Readers can open `/changelog`, the canonical release history linked from the
  application footer, without joining a room. `/releases` remains a rendered
  alias, and `/releases.xml` is the feed. The application shows its current
  version separately from date-ordered history; historical version numbering
  is preserved, not silently rewritten to fit the current sequence. Entries
  offer player-facing notes when available and expandable technical changes
  with source links. Without public notes, the status and deterministic
  technical history are shown open on `/changelog`, the site changelog, the
  feed and the GitHub Release.
- Public notes are optional enrichment. `model.policy: off` deliberately skips
  generation without a provider key or provider request; it is not a provider
  failure and does not prevent a technical-only release.
- Missing public notes, archived notes, intentionally skipped generation and
  provider-failed notes are distinct states. A provider-failed entry explicitly
  says notes are unavailable and offers technical history; it does not reuse
  polished text from an earlier attempt or invent an explanation from an error.
- A maintainer reviews a candidate bound to the proposed version and exact
  source revision. Publication requires the matching reviewed candidate and
  passing checks; a stale, changed or malformed candidate cannot reuse an
  unrelated pass. Preparation alone publishes no tag or release. Release
  publication is not proof that the player application has been deployed.
- Preparation refuses when the previous release tag is missing, rather than
  versioning from an invented baseline. A rerun keeps a matching open candidate
  from the same repository with valid or intentionally skipped notes when its
  source revision, version, release tag and previous tag match. Fork PRs are
  ignored, even when they reuse the release branch name; a nonmatching candidate
  does not suppress preparation.
- Optional editorial generation failure is visible to release administration,
  separately from player-service health. Invalid evidence remains a failure,
  rather than being laundered into a technical-only success. All public history
  projections agree about note availability for the same release.

No fabricated notes, automatic review bypass, credential rotation or spending
increase as an error-handling strategy.

#### Native verification

As a maintainer, I want one verification command on our own machines, so that
checking a candidate does not require a hosted CI vendor or production access.

- Fast mode checks source quality and unit behavior; full mode also checks
  coverage, the Cloudflare backend and the built Worker, including rendered
  guest gameplay, authorization rejection, party recovery, telemetry failure and
  recovery, and cleanup in disposable storage.
- Full verification uses generated local identities and refuses production
  credentials. It never imports, resets or migrates an existing deployment.
- A failed command stops verification and returns nonzero. Output identifies
  the mode, commands and source revision when Git metadata is present. For
  source archives it reports that absence; the existing caller snapshot owns
  identity. The caller retains candidate-bound logs and browser evidence,
  rather than relying on a vendor's job badge.
- Local verification is not deployment, hosted account acceptance or a live
  player-usage measurement. Release publication keeps its existing review and
  integrity requirements.

#### Native application release

As a maintainer, I want checked changes to reach players without a hosted CI
bill, while failed releases leave guest identities and accepted poems intact.

- A new trunk revision receives fast checks on our native executor. Full checks
  also run twice daily even when trunk has not changed; a full failure is owned
  repair evidence, not permission to hide or discard accepted work.
- The deployed Worker is the production-configured artifact exercised in
  isolation, not the local-mode game build. Runtime credentials are not build
  inputs. Missing or invalid required production bindings refuse service rather
  than issuing credentials or accepting writes with a development default.
- Promotion is serialized and cannot replace a newer serving source with an
  older one. Its source identity, backend readiness and a player entry journey
  are read back after activation.
- A failed or interrupted promotion restores the previously serving compatible
  Worker version and verifies recovery. It never imports, restores or resets
  player data. An incompatible data migration requires a separate recovery
  decision, not an automatic rollback across it.
- Release failure and recovery reach the existing Sentry-owned operator intake.
  An unavailable reporting sink cannot turn a failed release into success.
  Skipping an unchanged failed candidate keeps the failed release verdict;
  restoring the prior Worker is service recovery, not a successful new release.
