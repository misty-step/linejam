# Drop the legacy mode columns from games + rooms

Priority: P3 · Status: ready · Estimate: S

## Goal

The single-mode consolidation widened `games.mode` and `rooms.selectedMode` to
`v.optional(v.string())` and left them in place — nothing reads or writes them,
but dropping them outright would fail Convex schema validation against existing
rows that still carry a value. Remove the dead columns properly so the "legacy,
unused" comments don't become permanent fixtures.

## Oracle

- [ ] A one-shot `internalMutation` migration patches every `games` row to remove
      `mode` and every `rooms` row to remove `selectedMode` (or sets them
      undefined), run once against the deployment.
- [ ] A follow-up schema change drops `games.mode` and `rooms.selectedMode`
      entirely; `pnpm typecheck` + `pnpm test` stay green.
- [ ] No reader/writer of either field exists (already true post-consolidation;
      re-verify with a grep before dropping).

## Notes

Deferred from the mode consolidation (PR #275). Sequencing matters: migrate the
data first, deploy, then drop the columns in a second change — dropping the
validator while rows still carry the field breaks the deploy. Low priority; the
optional columns are inert, this is pure hygiene.
