# Architecture

Linejam runs a Next.js/React client over application-owned Convex tables and
functions, with Parlor owning live room membership, presence, and match
envelopes. Clerk is optional account identity; guests use signed credentials.
Current dependencies and commands live in `package.json`, not this document.

## Current ownership

| Concern                                            | Owning source                                                                                                  |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Room codes, joining and room membership            | `@parlor/convex` plus `convex/rooms.ts`, `convex/lib/room.ts`, `convex/lib/parlor.ts`                          |
| Guest issuance, cookies and identity               | `app/api/guest/session/handler.ts`, `lib/guestSession.ts`, `lib/auth.ts`, `convex/lib/auth.ts`                 |
| Presence, host recovery and abandonment            | `@parlor/convex` plus `convex/presence.ts`, `convex/abandonment.ts`                                            |
| Start, rounds, accepted submissions and completion | `convex/game.ts`, `convex/lib/sessionLifecycle.ts`, `convex/lib/gameRules.ts`                                  |
| Poem assignment and reader selection               | `convex/lib/assignmentMatrix.ts`, `convex/lib/assignPoemReaders.ts`                                            |
| Private artifacts, publication and retention       | `convex/poems.ts`, `convex/shares.ts`, `convex/favorites.ts`, `convex/retention.ts`                            |
| Rendering, artwork and interaction                 | `app/`, `components/`, `hooks/`, `lib/audio.ts`, `components/SoundProvider.tsx`, `components/SoundControl.tsx` |
| Identity tokens and color preference               | `lib/design/tokens.ts`, `lib/colorMode/`                                                                       |

Linejam owns cue selection and shared mute behavior. It consumes Cuelume live
synthesis through `@parlor/web/audio`; Parlor does not own Linejam's sound design.

`convex/schema.ts` owns the schema. In outline:

```text
players, roomMembers, matches, matchParticipants
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

The app-level `UserProvider` acquires one guest session per document and shares
it across routes and room phases. The issuer reports server-relative
`validForMs`; the fetcher charges request/body time against a local
`performance.now()` deadline, so device wall-clock skew cannot prolong proof
or cause immediate reacquisition loops. Expired proof gates private queries
while reacquisition runs. Clerk arrival fences guest proof immediately, and
sign-out reacquires rather than restoring a potentially revoked guest.

Keep operational detail in [local development](local-development.md),
[testing](testing.md), [deployment](deployment.md), [sharing privacy](sharing-privacy.md),
[retention](ops/data-retention.md), and [migration sequencing](convex-migrations.md).

## Parlor boundary

`vendor/parlor/UPSTREAM.json` records the immutable Parlor source commit. The
owner importer records commit-matched installed-source guidance under
`.agents/skills/parlor`. Convex is an application-owned peer dependency, not a
second runtime inside Parlor.

| Parlor owns                                                            | Linejam retains                                                              |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Room-code allocation, create/join/leave/close, seats and presence      | Invitation layout, selected avatars, pen names, guest cookies and Clerk link |
| Frozen match participants, host recovery, paginated match abandonment  | Nine-round assignments, word validation, poems, reveal and reader fallback   |
| Generic match envelopes (`hardDeadline: false` for untimed human play) | Archive, favorites, public links, retention, historical code recaps          |

New rooms use Parlor tables composed into `convex/schema.ts`. Room capacity is
8, with four-character alphanumeric invitation codes. Create, join, match start,
completion and abandonment compose inside the caller's Convex transaction.
Failed joins return structured receipts so admission-attempt counters commit;
the browser renders that failure, and CLI/MCP translate it after the mutation
has returned.

`roomMembers` owns live membership and presence. Successful game starts and
line submissions refresh presence alongside browser heartbeats. `roomPlayers`
retains Linejam pen names, avatars and user-to-player mappings; it is not live
membership or blanket permission to read later games. Completed native games
use their frozen `matchParticipants` for private reading, favorites, publication
and reader fallback. Live spectators receive only revealed text. After closure,
every frozen author may read and reveal remaining poems without live presence;
this does not reopen membership. Closed spectators receive the unavailable-room
screen rather than an unusable reveal view.

Linejam verifies its own guest credential or Clerk identity before calling
Parlor's trusted identity resolver. `GUEST_TOKEN_SECRET` still belongs to
Linejam's web/backend boundary; no Parlor guest signing key is needed. Account
linking keeps the room's `playerId`, clears its guest marker, and rejects
overlapping guest/account profiles in the same room before transferring data.
Linking follows indexed ownership and participant records instead of unrelated
room history. Guest-owned history remains subject to Convex's single-transaction
limits.

Historical invitations cannot admit players. Their retained artifacts remain
readable, and the explicit bounded drain in
[`convex-migrations.md`](convex-migrations.md#parlor-invitation-drain) closes
legacy lobbies and abandons unfinished games without fabricating completion.
Native retention drains frozen match records before removing their parent
room and keeps referenced identities; see
[`ops/data-retention.md`](ops/data-retention.md).

Production cutover requires separate deployment and migration authority under
`docs/convex-migrations.md` and `docs/deployment.md`. Local acceptance does not
grant either operation.
