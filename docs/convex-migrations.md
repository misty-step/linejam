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
class, not a TypeScript schema parser. A false positive should be resolved by
separating the migration and contraction, which is the safer release shape.
The check fails closed if it cannot resolve or diff the base revision.

If migrations move to multiple modules, update the guard and its regression
tests in the same change.
