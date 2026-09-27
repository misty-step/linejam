# Convex Schema Migrations

Convex validates the declared schema against stored documents during a code
push. A migration included in that push cannot repair documents that already
violate a newly contracted schema: validation blocks the deployment before the
migration becomes callable.

Use expand, migrate, contract for every incompatible data-shape change.

## Required sequence

1. **Expand.** Make the schema accept both old and new shapes. Add new fields as
   optional where necessary, and make application code tolerate both. Deploy.
2. **Migrate.** Add an idempotent, bounded migration. Prove its logic with
   `convex-test`, deploy it while the schema remains tolerant, then run it in
   production under the authority rules in `docs/ops/observability-ci.md`.
   Record examined and changed row counts and verify the postcondition.
3. **Contract.** In a later PR and deployment, remove the retired fields and
   compatibility paths. Only do this after production migration evidence
   exists.

The migration and the schema contraction must not share a PR. Expansion and a
backfill may share a PR when the deployed application remains compatible with
both shapes.

## Parlor invitation drain

The Parlor cutover is an expansion: native rooms and games add optional identity
and match references while historical schemas remain valid. Do not backfill old
rooms into invented native rosters. Historical invitations stop accepting joins;
their completed poems, favorites and public recaps retain their existing access
rules.

`internal.migrations.drainLegacyRooms` is an explicit operation, not a cron or a
deployment side effect. Run it only on an explicitly authorized, verified target
using the target-selection and evidence rules in
[`ops/observability-ci.md`](ops/observability-ci.md). Local verification does not
authorize shared-development or production writes.

1. Preview with `{ "dryRun": true, "cursor": null }`. Pass each
   `continueCursor` into the next call until `isDone=true`, retaining numeric
   `scanned`, `eligibleAbandoned`, `closed` and `abandoned` counts. Each call
   examines at most eight legacy rooms and applies the normal bounded poem
   cardinality guard without writing.
2. With migration authority, restart at a null cursor with `dryRun=false` and
   page to completion. Legacy open invitations are stamped closed. Unfinished
   games are abandoned, not completed or revealed; existing lines are retained.
   Empty lobbies enter the seven-day retention path. Completed and protected
   artifacts keep their existing lifecycle state.
3. Repeat from a null cursor and require `scanned=0`, `closed=0`,
   `abandoned=0`, `isDone=true`. Verify an old invitation rejects a fresh join,
   a retained participant can read a completed artifact, and native rooms were
   not changed.

Preserve the sanitized receipts with the authorized deployment record. Remove
legacy schema fields only in a later contraction after those postconditions
have been observed on the target.

## Machine-authorship cleanup receipts (Release A)

Release A deliberately keeps `users.kind`, `users.aiPersonaId`,
`games.completionKind`, and the four legacy AI tables in the schema. Do not
remove them until a later contraction PR has production evidence from
`internal.migrations.cleanupMachineAuthorship`.

Run one phase at a time, passing each returned non-null `cursor` into the next
invocation of that phase until `remaining` is false. Record every receipt's
`phase`, `scanned`, `changed`, `blocked`, `remaining`, and `cursor`. Run phases
in this order:

1. `games`
2. `lineAttribution`
3. `roomPlayers`
4. `readers`
5. `humanUserFields`
6. `aiTurns`
7. `aiRoundLocks`
8. `aiUsage`
9. `aiGenerationMetrics`
10. `aiUsers`

Before `aiUsers`, restart phases 1–9 from a null cursor and run each to
`remaining=false`. The required pre-deletion postcondition is a complete
second pass with aggregate `changed=0` and `blocked=0`, plus an immediate empty
receipt (`scanned=0`, `changed=0`, `remaining=false`) for each of `aiTurns`,
`aiRoundLocks`, `aiUsage`, and `aiGenerationMetrics`. Pass
`verifiedZeroChangePrerequisites: true` to every `aiUsers` invocation only
after recording those receipts; the mutation rejects `aiUsers` without this
explicit attestation. This ordering is essential: `lineAttribution` can
identify an AI-authored line only while its legacy AI user still exists.

`aiUsers` must be last. It refuses to delete an AI identity while a room
membership or reader assignment still references it. Any non-zero `blocked`
count invalidates the run; finish the dependent phases and restart `aiUsers`
from a null cursor. After it completes without blocked rows, restart `aiUsers`
from a null cursor and record its aggregate `changed=0`, `blocked=0` pass.

Preserve all receipts with the production deployment record; only then may a
separate PR remove the legacy validators and tables.

## Pen Pals avatar ids (completed 2026-09-27)

The Pen Pals cast replaced the first cast's eight stored ids index for index:
pip→rhyme, moss→haiku, pebble→hush, orbit→quill, sprout→sonnet,
sunny→doodle, ziggy→dusk, plum→ode. Because the order is aligned,
`getDefaultAvatarId` gives every membership that never chose the successor of
the character it showed before. Reordering `AVATAR_IDS` would silently change
those characters.

1. Expansion (#522): `roomPlayers.avatarId` accepted both sets. Writes stored
   Pen Pals ids, and responses answered in first-cast ids so bundles from before
   the release kept drawing.
2. Migration: `migrateAvatarIds` examined at most 200 memberships per call.
   - Shared dev, 20:39–20:42 UTC: 3,800 of 19,956 rewritten; the final dry run
     found none on every page.
   - Production, 21:11–21:13 UTC, after an encrypted export: 1,876 of 14,990
     eligible, and 1,876 changed (moss 226, orbit 215, pebble 254, pip 257,
     plum 233, sprout 199, sunny 268, ziggy 224). The final dry run found none
     on all 75 pages.
3. Contraction: the validator accepts only `AVATAR_IDS`, responses answer Pen
   Pals ids, and the retired ids, their mapping and the migration are gone.

The automated guard below did not cover this change. `avatarIdValidator` lives
in `convex/lib/avatars.ts`, so narrowing it leaves `convex/schema.ts`
unchanged. The order was held by hand, and Convex's own validation on the
schema push was the backstop.

## 2026-07-04 incident

PR #298 introduced `dropLegacyModeColumns` while its schema diff removed
`games.mode` and `rooms.selectedMode`. Convex rejected the contracted schema
because production still contained 153 game documents and one room document
with those fields. The rejected deployment also prevented the new migration
from becoming callable, blocking unrelated production releases.

Recovery required the full sequence that should have shipped originally:

1. restore and deploy a schema that tolerated the legacy fields;
2. deploy and run the migration, verifying 153 games and one room were cleared;
3. deploy the strict schema only after the stored data was clean.

The regression fixture in
`tests/scripts/check-schema-migration-sequencing.test.ts` preserves this exact
failure shape without depending on historical Git objects.

## Automated guard

`scripts/ci/check-schema-migration-sequencing.mjs` compares a pull request with
its base and blocks changes that both:

- remove a property from `convex/schema.ts`, including fields that use inline,
  reusable, or multiline validators; and
- add an exported Convex function to `convex/migrations.ts`.

This is intentionally a conservative text-diff guard for the known outage
class, not a TypeScript schema parser. It permits two proved-safe same-field
expansions: a `v.union` whose literal values are a strict superset of the base
validator, and the unchanged validator wrapped in `v.optional(...)`. Quoted
values remain exact, and unchanged closing delimiters are retained when a
multiline validator changes indentation. Unsupported expressions fail closed.
Optional-to-required changes, literal-union narrowing, and all other same-field
rewrites remain blocked. Resolve any other false positive by separating the
migration and schema change. The check fails closed if it cannot resolve or
diff the base revision.

If migrations move to multiple modules, update the guard and its regression
tests in the same change.
