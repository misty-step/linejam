# Architecture

Linejam runs a Next.js/React client over application-owned Convex tables and
functions. Clerk is optional account identity; guests use signed credentials.
Parlor is **not installed**. Current dependencies and commands live in
`package.json`, not this document.

## Current ownership

| Concern                                            | Owning source                                                                                  |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Room codes, joining and room membership            | `convex/rooms.ts`, `convex/lib/room.ts`                                                        |
| Guest issuance, cookies and identity               | `app/api/guest/session/handler.ts`, `lib/guestSession.ts`, `lib/auth.ts`, `convex/lib/auth.ts` |
| Presence, host recovery and abandonment            | `convex/presence.ts`, `convex/lib/room.ts`, `convex/abandonment.ts`                            |
| Start, rounds, accepted submissions and completion | `convex/game.ts`, `convex/lib/sessionLifecycle.ts`, `convex/lib/gameRules.ts`                  |
| Poem assignment and reader selection               | `convex/lib/assignmentMatrix.ts`, `convex/lib/assignPoemReaders.ts`                            |
| Private artifacts, publication and retention       | `convex/poems.ts`, `convex/shares.ts`, `convex/favorites.ts`, `convex/retention.ts`            |
| Rendering, artwork and interaction                 | `app/`, `components/`, `hooks/`                                                                |
| Identity tokens and color preference               | `lib/design/tokens.ts`, `lib/colorMode/`                                                       |

`convex/schema.ts` owns the schema. In outline:

```text
users → roomPlayers → rooms → games → poems → lines
  └───────────────────────── favorites / shares
```

Convex mutations validate intentions and commit transitions; reactive queries
project only what the viewer may see. The assignment matrix freezes the game's
writers. Late room members spectate until the next game. All nine lines must be
accepted before completion; reading happens afterward. Retried accepted
submissions must not add another line, including the final-round retry window.

Guest tokens are Linejam's signed payload/signature format, not JWTs. The HTTP
session route owns cookie continuity and returns a bearer for in-memory Convex
arguments; localStorage is not the guest credential authority. Current backend
identity resolution prefers Clerk, then a verified guest token. That precedence
and guest-to-account linking matter when changing identity infrastructure.

Keep operational detail in [local development](local-development.md),
[testing](testing.md), [deployment](deployment.md), [sharing privacy](sharing-privacy.md),
[retention](ops/data-retention.md), and [migration sequencing](convex-migrations.md).

## Parlor assessment

Source review: Parlor commit
[`c8f5d6480bd258fe8583b7e5357d31aca5ec60cc`](https://github.com/misty-step/parlor/tree/c8f5d6480bd258fe8583b7e5357d31aca5ec60cc).
Package/integration source was clean; separate website edits were not changed.
The imported `.agents/skills/parlor/SOURCE.json` records an older guidance-only
snapshot, not an installed framework pin. This is a static compatibility
assessment, **not a tested migration or a dependency selection**.

### Intended boundary

| Parlor should own                                                      | Linejam should retain                                                            |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Room-code allocation, parsing, lookup and generic create/join behavior | Invitation layout and product code/lifetime policy                               |
| Players, memberships, seats and presence/host recovery                 | Pen names, chosen character art and durable author/account mapping               |
| Frozen participants, late-join eligibility and match envelopes         | Nine-round assignments, word validation, poem state and viewer permissions       |
| Generic completion/abandonment transitions                             | Whole-poem reveal, reader fallback, archive/favorites/sharing and data retention |

Parlor is currently a source-workspace distribution using the consuming app's
Convex tables, not another hosted room service or a Convex Component. Its React
package exports primitives and hooks, not a ready-made Linejam lobby or waiting
screen. Adopting it does not require replacing Linejam's identity or artwork.

### Decisions before migration

- **Capacity and code policy:** Parlor core fixes room seats at 12; setting
  `beginMatch` bounds to 2–8 does not reject a ninth room member. Add or agree a
  framework-owned room-capacity policy. Its four-character alphabet includes
  digits but excludes I/O, unlike existing Linejam codes. It checks open rooms
  for collisions, permitting reuse after closure; Linejam checks retained rooms.
  Preserve existing invitations and code-based recap history deliberately.
- **Selected avatars:** current Parlor create/join arguments and member schema
  do not store Linejam's selected character. Decide between application-owned
  membership metadata and a reusable Parlor extension; do not fork join logic
  or force seat-derived artwork onto the game.
- **Identity and existing data:** token formats, lifetimes and credential
  precedence differ. Parlor does not supply the HTTP cookie/continuity route or
  an account-link operation. Its player IDs and room schema cannot replace
  Linejam user/room IDs by renaming imports. Preserve verified guest continuity,
  Clerk linking, host/reader/matrix references, authorship, favorites, public
  links, issuance throttling and per-local-backend identity isolation.
- **Lifecycle policy:** Parlor starts are host-only and select eligible present
  members; Linejam rematches may be started by any member after completion and
  currently snapshot all human memberships. Seat/shuffle and host eligibility
  also differ. Choose intended behavior rather than inherit defaults. Untimed
  play is already supported through `beginMatch({ hardDeadline: false, ... })`;
  keep Linejam's human game free of an enforced 30-minute cap.
- **Completion and cleanup:** Linejam completes writing before reveal and allows
  idempotent final-line retries afterward. Do not require an active match on
  those completed-game paths. Parlor's paginated sweeper abandons envelopes,
  not Linejam poems or rooms. Agree atomic composition or derived lifecycle
  ownership for room closure, partial-poem privacy and retention; continue every
  sweeper page. This is a concrete framework/application design question.
- **Build integration:** the private workspace packages export built `dist`.
  Bring a reviewed source pin and its manifests into the Docker dependency
  layer, build before Next/Convex consumption, and establish a deliberate local
  rebuild path. Toolchain compatibility has not been exercised.

The relevant Parlor implementations are `integrations/convex/convex/rooms.ts`,
`identity.ts`, `matches.ts`, `presence.ts`, `abandonment.ts` and `schema.ts`, plus
`packages/core/src/index.ts` and `packages/auth/src/server.ts` at the above pin.
These questions belong with Parlor's owner, not permanent parallel lifecycle
implementations in the consumer.

### Order and proof

The UI polish is independent of migration. `RoomPage` owns one shared frame,
`RoomChrome` owns phase-appropriate options, and `RoomInvite` owns code/QR/share
presentation. Entry and waiting use existing room data without a speculative
adapter framework or a second room authority.

For the next architecture lane, agree the policies above, then prove a complete
local-only integration with existing-data fixtures: guest renewal/account link,
2–8-player create/join with ninth-member rejection, atomic match/poem start,
late-join spectator/rematch eligibility, host departure, nine human rounds,
final-line replay, reader fallback, reveal and rematch. Separately prove
abandonment/retention and preserved private/public archive ownership. A migration
must remove the old shared machinery and preserve saved artifacts, not maintain
two room authorities indefinitely. Production cutover follows the existing
migration and deployment contracts only after that behavior is established.
