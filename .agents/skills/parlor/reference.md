---
name: parlor
description: Build and review phone-first multiplayer games with Parlor on Convex and React. Use when integrating guest authentication, rooms, presence, frozen match participants, game commands, or mobile browser capabilities.
---

# Parlor

Parlor supplies shared room, identity, presence, and match infrastructure. The game owns its rules, phases, prompts, private state, scoring, and presentation. Work from the consuming game's requirements and the installed source, not remembered APIs.

## Import only into a consuming repository

Parlor maintains this skill in `skills/parlor/SKILL.md`. Import it only into a consuming game's `.agents/skills/parlor`; never deploy it to a home/global skill directory or unrelated repositories. From a reviewed Parlor checkout:

```sh
node scripts/import-skill.mjs --target /path/to/game
```

The owner-provided importer reads the game's pinned `vendor/parlor` checkout or `vendor/parlor/UPSTREAM.json`, imports guidance from that exact commit, and writes a local `SKILL.md`, `reference.md`, and `SOURCE.json`. It never fetches a newer skill, changes dependencies, or updates a source pin. A copied vendor tree can omit the skill: the recorded commit must then be available in the importing Parlor checkout's local Git objects.

For an app without Parlor source or dependencies, explicitly use `--guidance-only`. This imports the owner's working-tree guidance, records its base revision and content hash, and states that the framework is **not installed**. It neither selects nor authorizes a migration. Preserve and review an existing differing import before replacing it; an identical import is left untouched. Keep other repository skills intact.

Read the imported `SOURCE.json` and inspect installed source signatures before coding. Maintain guidance upstream, not in derived consumer copies. A skill provides context; the user's request and the game's requirements remain authority.

For a new integration, use [Run First Tap](https://parlor.mistystep.io/docs/first-game/) and the relevant parts of `examples/first-tap` at the selected revision. Existing integrations need only the contracts touched by the task, not a complete example read. First Tap's setup is isolated-development tooling, not a production secret configurator.

## Align with installed source

Parlor is a pre-1.0 source distribution. Its `@parlor/*` packages are private workspace packages, not npm releases. Do not suggest `npm install @parlor/*`.

For an existing app, follow [source-workspace installation](https://parlor.mistystep.io/docs/installation/). First inspect its manifests and any existing Parlor checkout. If Parlor is not installed:

```sh
mkdir -p vendor
git clone https://github.com/misty-step/parlor.git vendor/parlor
git -C vendor/parlor rev-parse HEAD
```

Keep the complete checkout, including `tsconfig.base.json`. Record the commit with the consuming project; prefer a Git submodule pinned to a reviewed commit for maintained integrations. Do not silently pull a newer revision while implementing a game.

Merge these entries into the existing root `pnpm-workspace.yaml` package list; preserve all existing entries and settings:

```yaml
packages:
  # Keep your existing workspace entries here.
  - vendor/parlor/packages/*
  - vendor/parlor/integrations/*
```

Add the packages the game directly imports to its own `package.json` dependencies using `workspace:*`. For example:

```json
{
  "dependencies": {
    "@parlor/auth": "workspace:*",
    "@parlor/convex": "workspace:*",
    "@parlor/react": "workspace:*",
    "@parlor/web": "workspace:*"
  }
}
```

This is a fragment to merge, not a replacement manifest. Add `@parlor/core` if importing it directly. Declare the game's normal dependencies too: `convex`, React/React DOM, and `effect` if executing auth Effects. Match the checkout's package manifests and React peer range (currently React 19). The consuming workspace needs the TypeScript build tool; inspect Parlor's root manifest for its version and Node/pnpm requirements rather than relying on global tools.

```sh
pnpm install
pnpm -r --filter './vendor/parlor/packages/**' --filter './vendor/parlor/integrations/**' --if-present build
```

Package exports point to built `dist` files. Rebuild after a deliberate source update. Import the aligned repository-local skill with the owner-provided command above; inspect `.agents/skills/parlor/SOURCE.json` and its pinned `reference.md`. The website skill may be newer than the installed packages.

The vendored workspace entries include only the library directories, not Parlor's apps, examples, or root package. Preserve existing dependency build permissions and compiler exclusions; the installation guide records the current toolchain requirements.

Inspect the installed export maps, signatures, and implementation relevant to the changed integration. Examples and current website docs explain intent but may not match an older pin. Read additional auth, match, or browser contracts when the change crosses those boundaries, not as a universal preflight.

## Compose application-owned state

Parlor uses ordinary application-local Convex tables, not an installed Convex Component. Merge the tables into the game's schema and add separate game tables referencing `roomId` and `matchId`:

```typescript
import { parlorTables } from "@parlor/convex/schema";
import { defineSchema } from "convex/server";

export default defineSchema({
  ...parlorTables,
});
```

In the consuming app's `convex/rooms.ts`, expose the registered room endpoints:

```typescript
export {
  createRoom,
  joinRoom,
  getRoomState,
  heartbeat,
  leaveRoom,
  closeRoom,
} from "@parlor/convex/rooms";
```

Generate the consuming application's Convex API and use its `api.rooms.*` references. Do not import generated code from Parlor's reference application.

| Endpoint                 | Arguments and observable result                                                                                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `createRoom`             | `{ displayName, guestToken? }` → `{ roomId, playerId, code, seatIndex, eligibleFromCycle }`. No `ok` discriminator.                                                                              |
| `joinRoom`               | `{ code, displayName, guestToken? }` → `{ ok: true, roomId, playerId, code, seatIndex, eligibleFromCycle }` or `{ ok: false, code }`. Handle the failure union and thrown authentication errors. |
| `getRoomState`           | `{ roomId, guestToken? }` → `{ viewerPlayerId, room, members, activeMatch }`. The projected room identifier is `room.id`; `activeMatch` may be `null`.                                           |
| `heartbeat`              | `{ roomId, guestToken? }` → `{ roomId, playerId, hostPlayerId, isHost, lastSeenAt }`.                                                                                                            |
| `leaveRoom`, `closeRoom` | `{ roomId, guestToken? }`; closing requires the host.                                                                                                                                            |

## Keep identity and authority on the server

- Import `issueGuestToken` and `verifyGuestToken` from `@parlor/auth/server`, never the package root or a client bundle. Both return Effects; execute them with `Effect.runPromise` from `effect`.
- Issuance takes `{ keyId, secret, audience }` with optional lifetime/identity fields and returns `{ token, claims }`. `secret` is a cryptographically random `Uint8Array` of at least 32 bytes. Verification takes `(token, { keyRing: { keys }, audience })` and returns verified claims. Do not decode a bearer token and treat its payload as verified identity.
- The browser issuer callback accepts optional `{ mode: "acquire" | "refresh", token? }` and must resolve `{ token: string, expiresAt: number }`; use `claims.expiresAt`, in milliseconds. Parlor does not supply the HTTP issuance endpoint or cookie lifecycle.
- Configure the same server-only key material in the issuer and Convex. Convex reads `PARLOR_GUEST_TOKEN_KEYS` as JSON mapping key IDs to base64url secrets, and `PARLOR_GUEST_TOKEN_AUDIENCE` (default `parlor`). Never expose these secrets in public environment variables, client code, logs, or prompts.
- Preserve a guest ID across refreshes only from server-verified continuity. A signed `HttpOnly`, `SameSite=Lax`, production-`Secure` cookie is one application-owned mechanism. Reject client-supplied guest IDs and unverified/expired token claims as renewal authority. Keep bearer-token and continuity-cookie lifetimes distinct; document how expired credentials recover without silently changing identity.
- `resolvePlayer(ctx, guestToken?)` returns a server-resolved actor. Without a guest token it can use verified Convex auth identity; an invalid supplied guest token does not fall back to that identity. Existing players resolve by default; creation requires `{ create: true }` in a mutation. Room create/join already create players as needed.

The [authentication guide](https://parlor.mistystep.io/docs/authentication/) explains the example's application-owned [issuance and continuity route](https://github.com/misty-step/parlor/blob/master/examples/first-tap/app/api/guest/route.ts). Read `examples/first-tap/app/api/guest/route.ts` from the pinned checkout when adapting it to the game's HTTP runtime.

## Protect every game transition

The game server owns phase transitions, deadlines, randomized choices, and scores. Clients submit intentions, never authoritative score deltas, actor objects, phase timestamps, or participant lists.

- Start inside a game mutation with `actor = await resolvePlayer(ctx, args.guestToken)`, then `await beginMatch(ctx, { roomId: args.roomId, actor, minPlayers, maxPlayers })` from `@parlor/convex`. It checks host authority, snapshots eligible present members into `matchParticipants`, and returns an envelope with `id` (not `matchId`). Create the game-specific state in the same transaction. Do not use the generic `startMatch` endpoint if it would leave the game uninitialized.
- On commands, call `requireActiveMatch(ctx, matchId, roomId)` before game writes. It checks status, room association, and the match's hard deadline when enabled, **not actor authorization or game-phase eligibility**. Game round deadlines are separate server-owned state.
- The default match cap is 30 minutes. To opt out, choose `hardDeadline: false` server-side in `beginMatch`'s input; omitted/`true` retains the cap. The envelope and room projection preserve the opt-out. This does not disable everyone-away abandonment, frozen participation, or game-phase deadlines. The generic `startMatch` endpoint does not expose this option.
- Resolve the actor and explicitly enforce frozen participant membership. Inside a validated game mutation, the authorization fragment is:

```typescript
import { requireActiveMatch, resolvePlayer } from "@parlor/convex";
import { ConvexError } from "convex/values";

const actor = await resolvePlayer(ctx, args.guestToken);
await requireActiveMatch(ctx, args.matchId, args.roomId);
const participant = await ctx.db
  .query("matchParticipants")
  .withIndex("by_match_player", (q) => q.eq("matchId", args.matchId).eq("playerId", actor.playerId))
  .unique();
if (!participant) {
  throw new ConvexError({ code: "MATCH_PARTICIPANT_REQUIRED" });
}
```

Then enforce the game's phase, turn, submission uniqueness, and deadline rules. Queries need authorization too: explicitly project only the fields this viewer may see. Never send hidden answers, truth, authorship, or unrevealed options to a client and merely hide them in React.

- New mid-match members are not added to the frozen roster. Spectator access is a game-owned safe projection; next-cycle eligibility still requires presence and player bounds. Never replace the current roster with all room members.
- Finish with `completeMatch(ctx, { matchId, actor })` after server-validated completion, atomically with final scores. Providing `actor` checks participation, not permission to end the game's phase. Omitting it bypasses that check and belongs only in an already-authorized internal path.
- `abandonMatch(ctx, { matchId, reason, actor? })` accepts `host-ended`, `everyone-away`, or `hard-deadline`. `host-ended` requires a resolved host actor; the other reasons are trusted maintenance decisions, not client-selectable shortcuts. These helpers update envelopes, not game-specific rows.
- Presence is derived from timestamps. Host self-healing occurs during heartbeat/leave, not a background timer. It selects the non-host-stale candidate with the lowest seat index, breaking ties by player ID; active-match transfers restrict candidates to frozen participants still in the room. A later mutation can heal the host when no candidate was previously eligible, so do not promise immediate transfer while every client is disconnected.

## Continue every sweeper page

`sweepAbandonedMatches(ctx, { limit?, cursor? })` returns `{ scanned, abandoned, hasMore, continueCursor }`. The game owns the internal mutation and cron registration. Schedule each continuation with the opaque cursor until `hasMore` is false; a page with zero abandoned matches can still have more pages. Restarting only the first page can starve later matches.

The sweeper abandons hard-expired or everyone-away envelopes, not rooms or game data. `hardDeadline: false` skips only the fixed cap. It neither transfers hosts nor replaces command-time lifecycle and game-phase deadline guards. The [matches guide](https://parlor.mistystep.io/docs/matches/#sweep-every-page) shows the application-owned wrapper.

## Compose the React client

- Use the application's `ConvexProvider` from `convex/react`. Own one `useGuestCredential({ issuer, autoAcquire: true })` at the application boundary and share its result through application-owned state/context; Parlor does not export a guest provider. Handle renewal failure and memory-only storage explicitly. Retry initial acquisition with `acquire()` when no proof exists; use `refresh()` for retained proof. Keep selected-room state outside temporarily credential-gated rendering.
- Do not query or mutate guest-only endpoints until `credential` exists; use Convex's `"skip"` query argument while waiting. Send the credential as `guestToken`, not as a player ID.
- Import `@parlor/react/styles.css` when using Parlor's UI. Inspect exported component props rather than guessing them.
- `useHeartbeat` requires a sender returning `void` or `PromiseLike<void>`, not the heartbeat mutation receipt. For a component with nullable `roomId`/`guestToken` and a `heartbeat` mutation hook:

```typescript
useHeartbeat({
  enabled: roomId !== null && guestToken !== null,
  send: async () => {
    if (roomId === null || guestToken === null) return;
    await heartbeat({ roomId, guestToken });
  },
});
useWakeLock({ enabled: matchActive });
```

Wake lock and audio are progressive browser capabilities. Denial, unsupported browsers, suspended tabs, and muted audio must not block play.

## Verify the changed integration

Exercise the path changed by the task against the consuming game's approved backend and HTTP guest issuer. A presentation-only change does not require replaying the full game lifecycle. For a new integration, verify create → join → start → submit → reveal → score → rematch with separate browser identities.

When a trust or lifecycle boundary changes, exercise its affected transitions and failure cases: same-player renewal, unauthorized commands and viewer-safe projections, frozen late-join/rematch eligibility, mutation-driven host departure, reconnects, or sweeper continuation as applicable. Browser capability changes need denied/unsupported behavior; distinguish physical-device evidence from viewport emulation and report unavailable environments.

The playground's local simulation does not prove guest signing, Convex functions, cookies, scheduling, or deployed mobile behavior. Review changed credential, authorization, and data boundaries before shipping. Production access, secret changes, destructive schema/data work, and deployment require separate operator authorization, not repeated approval for ordinary requested local implementation. Report the pin, paths and scenarios exercised, and verification gaps without unsupported stability claims.

For a bug or missing primitive, prepare a minimal reproduction with the pinned commit and expected/actual behavior. Linear owns current work, prioritization, and selected unresolved opportunities; create or update an item only when the user requests it. Historical GitHub reports may remain useful evidence, but are not an automatic intake queue. Exclude tokens, cookies, private data, and secrets. Keep durable contracts and portable procedures in the repository, concise work summaries in Linear, and raw or sensitive run output in approved retained artifact storage.

## References

- [Start here](https://parlor.mistystep.io/docs/getting-started/), [Run First Tap](https://parlor.mistystep.io/docs/first-game/), [source installation](https://parlor.mistystep.io/docs/installation/), and [API reference](https://parlor.mistystep.io/docs/api/).
- [Rooms and presence](https://parlor.mistystep.io/docs/rooms-and-presence/), [matches](https://parlor.mistystep.io/docs/matches/), and [React](https://parlor.mistystep.io/docs/react/).
- [Agent onboarding](https://parlor.mistystep.io/docs/agents/), [documentation index](https://parlor.mistystep.io/llms.txt), and [full documentation](https://parlor.mistystep.io/llms-full.txt).
- [Source repository](https://github.com/misty-step/parlor) and [canonical skill source](https://github.com/misty-step/parlor/blob/master/skills/parlor/SKILL.md). Use the installed commit instead of `master` when resolving a contract difference.
