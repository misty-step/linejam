# Convex Schema Migrations: Expand, Migrate, Contract

Convex validates `convex/schema.ts` against every row already in the table at
push time. That single fact is the whole reason this doc exists: you cannot
remove a field from the schema until every row has already stopped depending
on it, and you cannot depend on "the migration will run in this same deploy"
because the schema push and the migration run are not atomic with each
other — the schema push happens first, and it can fail on data the migration
hasn't touched yet.

## The 2026-07-04 incident

PR #298 ("drop legacy mode columns") added `migrations.dropLegacyModeColumns`
and removed the `mode`/`selectedMode` fields from `convex/schema.ts` **in the
same commit**. `git show 684de32 -- convex/schema.ts convex/migrations.ts`
is the exact diff. The result:

1. Convex push validated the new (contracted) schema against production data.
2. 153 `games` rows and 1 `rooms` row still had `mode`/`selectedMode` set —
   the migration that would have cleared them had never run against
   production, because it could only run _through_ a successful deploy.
3. Every deploy wedged, including the unrelated P0 CSP hotfix (linejam-912)
   that production needed immediately.
4. Recovery required an operator to run the migration manually against
   production, outside the normal deploy pipeline, before the schema push
   could succeed.

The gate that would have caught this (`scripts/ci/check-schema-migration-sequencing.mjs`,
below) did not exist yet; it does now, and its regression test replays this
exact diff.

## The sequence

Never contract schema in the same deploy that introduces its migration.
Three separate, independently-deployable steps:

1. **Expand.** Add the new field/shape alongside the old one. Schema keeps
   accepting both. Ship and deploy.
2. **Migrate.** Ship a migration (`convex/migrations.ts`, an
   `internalMutation` invoked via `npx convex run`) that backfills/clears
   data into the new shape. **Run it against production** and confirm it
   completed (row counts, not just "the deploy succeeded").
3. **Contract.** Only now, in a separate PR/deploy, remove the old
   field from `convex/schema.ts`.

Steps 2 and 3 must never land in the same change. Step 1 can sometimes merge
with step 2 (adding a field and its backfill together is safe — nothing yet
depends on the old field being gone).

## The gate

`scripts/ci/check-schema-migration-sequencing.mjs` runs in CI (`quality-gates`
job, pull requests only — see `.github/workflows/ci.yml`) and diffs the PR
against its base ref:

- `convex/schema.ts`: any **removed** field-definition line
  (`fieldName: v.something(...)`).
- `convex/migrations.ts`: any **added** exported Convex function
  (`export const name = internalMutation({ ... })` or `mutation`/
  `internalAction`/`action`).

If both are true in the same PR, the gate fails with the specific removed
field(s) and added migration(s) named, and points here. It is a text-diff
heuristic, not a schema-aware parser — deliberately, so it needs no build
step and runs in milliseconds — and it only needs to catch the shape of this
exact failure class, not every conceivable migration mistake. If migrations
ever move out of the single `convex/migrations.ts` file, update
`MIGRATIONS_FILE`/the glob in that script.

This is a **CI-only** check (it needs `git diff <base>...HEAD`, which
requires the PR's base ref and enough history — the `quality-gates` job
fetches both). It intentionally runs outside the Dagger containers the rest
of `quality-gates` uses, because it operates on git history rather than the
source tree, and containerizing a `git diff` buys nothing.

## linejam-019 lesson (annotated same day)

linejam-019 ("legacy mode column cleanup") is the card `dropLegacyModeColumns`
shipped under. The lesson recorded on that card: schema contraction and its
migration are two separate deploys, never one — see this doc for the
enforcement mechanism.
