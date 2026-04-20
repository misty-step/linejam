---
name: convex-migrate
description: |
  Drive a three-phase Convex schema migration (add optional → backfill → require)
  with production speed bumps, Canary-watched grace windows between phases, and
  ADR emission. Linejam-specific because `convex/schema.ts` has 14 v.optional()
  fields and live traffic requires the phased dance.
  Use when: schema change, "add a field to <table>", "make <field> required",
  "backfill <field>", "convex migration", "evolve the schema".
argument-hint: '<table>.<field> <operation>'
---

# /convex-migrate — linejam's three-phase schema dance

Linejam runs live traffic against a single Convex deployment. Dropping a
required field or flipping optional→required in one deploy races partial
writes against the new validator and throws `Document validation failed`
exceptions in the hot path. The fix is the boring one: **add optional →
backfill → require**, one phase per deploy, Canary-watched between each.

`convex/schema.ts` currently has **14 `v.optional(...)` fields** spread
across `users`, `rooms`, `roomPlayers`, `games`, `poems`, and `lines`.
Several are leftovers from prior migrations that never reached Phase 3
(e.g. `lines.authorDisplayName` — captured at write-time for pen-name
support). This skill is the mechanism for both directions: adding a new
optional, and closing one out into required.

Stops after Phase 3 ships green and an ADR lands at
`docs/adr/NNNN-<field>-migration.md`. Does not diagnose Dagger failures
(use `/ci`), does not rewrite data semantics (use `planner` first).

## Repo-specific invariants

Pulled verbatim from `.claude/repo-brief.md`. Crossing any of these is a
red line, not a suggestion.

1. **Never push prod Convex without `LINEJAM_ALLOW_PROD_CONVEX_SYNC=1`.**
   Invariant #3. The flag is an intentional speed bump between phases.
   Export per-command; never persist it in your shell rc. Dagger refuses
   prod sync by default — that refusal is load-bearing.
2. **Never run `convex dev` or server processes yourself.** Invariant #2.
   The user keeps `pnpm dev` running in a separate terminal. Phase 1's
   schema edit auto-regenerates `convex/_generated/api.d.ts` there. If
   types haven't refreshed, ask — don't spawn.
3. **Never push on red Dagger.** Invariant #1. Each phase ships through
   `pnpm ci:prepush`. No `--no-verify`.
4. **Never skip the Canary grace window between phases.** Partial-write
   races surface as `Document validation failed` logs from
   `convex/lib/errors.ts`. Advancing before `/monitor` closes clean risks
   compounding Phase 1+2 violations into Phase 3.
5. **Never batch sequential DB writes when you can `Promise.all`.**
   Invariant #6. Backfill actions use parallel writes inside each page.
6. **Every `while` loop needs a termination guard.** Invariant #7. The
   pagination loop in the backfill action is bounded by
   `MAX_PAGES`; never run unbounded.
7. **Commits follow Conventional Commits** (Invariant #9). Each phase
   ships as exactly one commit with the prescribed prefix below.

## The three phases

Each phase is one PR, one Conventional Commit, one prod deploy, one
`/monitor` grace window. Phases do not combine.

| Phase                | Schema change                                            | Code side                                                                       | Commit                                       | Post-deploy watch                                                    |
| -------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------- |
| **1 — Add optional** | `<field>: v.optional(v.<type>())` added to table         | Read sites tolerate `undefined`; write sites may or may not populate            | `feat(schema): add optional <table>.<field>` | `/monitor` 5m for `Document validation failed` in Convex + Canary.   |
| **2 — Backfill**     | No schema change                                         | Internal action paginates table and patches missing rows with the default value | `chore(schema): backfill <table>.<field>`    | `/monitor` 5m. Verify row count with the default matches total rows. |
| **3 — Require**      | `v.optional(...)` wrapper removed; field is now required | Typecheck forces every read/write site to honor the field                       | `feat(schema): require <table>.<field>`      | `/monitor` 5m. Watch for stragglers the backfill missed.             |

**Never merge Phase 3 until the Phase 2 deploy has been in prod past the
Canary grace window.** Even if the backfill action "completed," late
writers can still insert rows without the field until Phase 3 lands.
Phase 3 is what forecloses the race — the grace window is what confirms
no writer still needs the optional contract.

## Phase 1 — Add optional

### Edit `convex/schema.ts`

Minimum-viable schema change:

```typescript
// Before
poems: defineTable({
  roomId: v.id('rooms'),
  gameId: v.id('games'),
  indexInRoom: v.number(),
  createdAt: v.number(),
  // ...
});

// After
poems: defineTable({
  roomId: v.id('rooms'),
  gameId: v.id('games'),
  indexInRoom: v.number(),
  createdAt: v.number(),
  lastActiveAt: v.optional(v.number()), // Phase 1: optional for rollout
  // ...
});
```

Index additions belong in the same phase only if the new field is being
indexed — otherwise split them.

### Regenerate types

The user's `pnpm dev` (which runs `convex dev` in parallel) watches
`convex/schema.ts` and regenerates `convex/_generated/api.d.ts` on save.
If the user's terminal isn't running `pnpm dev`:

- Ask them to run `pnpm dev:convex` (Invariant #2 — never spawn it).
- Do NOT run `npx convex dev` yourself to force regeneration.

Confirm regeneration landed by running `pnpm typecheck` — it must pass
with the optional field accessible as `doc.<field> | undefined` at every
read site.

### Ship Phase 1

```bash
# Local verification
pnpm typecheck
pnpm ci:prepush
```

Commit exactly one logical change:

```
feat(schema): add optional poems.lastActiveAt

Phase 1 of 3. Adds the field as v.optional so existing rows validate
without backfill. Phase 2 backfills; Phase 3 requires.
```

Push. The release workflow auto-deploys `master` to prod Convex; no
manual Convex deploy is needed for Phase 1 in the normal flow. If the
hosted deploy is blocked and you need to push the schema from local:

```bash
LINEJAM_ALLOW_PROD_CONVEX_SYNC=1 npx convex deploy --prod
```

**Gate:** `/monitor` 5 minutes on the prod Canary dashboard watching for
`Document validation failed` noise. No new errors → Phase 1 is complete.

### Phase 1 rollback

Safe. Revert the schema commit (`git revert`) and redeploy. The new
optional field was unused by any read site outside its own table, so
nothing downstream breaks. The Phase 1 revert itself needs the same
`/monitor` window.

## Phase 2 — Backfill

### Write the internal action

Backfills are **internal actions**, not mutations. Actions can loop
through paginated batches and schedule themselves; mutations have a
transaction-size ceiling. File as
`convex/migrations/NNN-backfill-<field>.ts` (three-digit prefix,
incrementing from the highest existing file in that directory; start at
`001` if the directory is new).

```typescript
// convex/migrations/001-backfill-lastActiveAt.ts
import { v } from 'convex/values';
import { internalAction, internalMutation } from '../_generated/server';
import { internal } from '../_generated/api';
import { log, logError } from '../lib/errors';

const PAGE_SIZE = 100;
const MAX_PAGES = 10_000; // Termination guard per Invariant #7

export const backfillLastActiveAtPage = internalMutation({
  args: {
    cursor: v.union(v.string(), v.null()),
  },
  handler: async (ctx, { cursor }) => {
    const { page, isDone, continueCursor } = await ctx.db
      .query('poems')
      .paginate({ cursor, numItems: PAGE_SIZE });

    const needsBackfill = page.filter((row) => row.lastActiveAt === undefined);

    // Invariant #6: parallel writes
    await Promise.all(
      needsBackfill.map((row) =>
        ctx.db.patch(row._id, { lastActiveAt: row.createdAt })
      )
    );

    return {
      patched: needsBackfill.length,
      scanned: page.length,
      isDone,
      continueCursor,
    };
  },
});

export const backfillLastActiveAt = internalAction({
  args: {},
  handler: async (ctx) => {
    let cursor: string | null = null;
    let totalPatched = 0;
    let totalScanned = 0;
    let pages = 0;

    while (pages < MAX_PAGES) {
      pages++;
      const result: {
        patched: number;
        scanned: number;
        isDone: boolean;
        continueCursor: string | null;
      } = await ctx.runMutation(
        internal.migrations['001-backfill-lastActiveAt']
          .backfillLastActiveAtPage,
        { cursor }
      );

      totalPatched += result.patched;
      totalScanned += result.scanned;

      if (result.isDone) {
        log.info('Backfill complete', {
          migration: '001-backfill-lastActiveAt',
          totalPatched,
          totalScanned,
          pages,
        });
        return { totalPatched, totalScanned, pages };
      }

      cursor = result.continueCursor;
    }

    logError(
      'Backfill exceeded MAX_PAGES termination guard',
      new Error('max_pages_exceeded'),
      {
        migration: '001-backfill-lastActiveAt',
        totalPatched,
        totalScanned,
        pages,
      }
    );
    throw new Error(
      'Backfill exceeded MAX_PAGES. Investigate before re-running.'
    );
  },
});
```

Key contract points:

- **Per-page work is an `internalMutation`** — Convex transactions scope
  to a single mutation call. A mutation cannot loop across pages because
  it would blow the transaction size limit. The action is the driver;
  the mutation is the unit of consistent work.
- **`ctx.db.paginate({ cursor, numItems })`** is the only safe way to
  stream a large table. Don't `.collect()` — it will OOM on anything
  serious.
- **Use `row.<field> === undefined` as the overwrite guard.** Re-running
  the backfill must be a no-op for rows that already have the field.
  This is what makes rollback-and-re-run safe.
- **Log through `convex/lib/errors.ts`** (`log.info`, `logError`). Those
  emit structured JSON to the Convex dashboard and bridge to Canary.
  Don't `console.log` — the dashboard parses JSON only.
- **The `while` loop has `pages < MAX_PAGES`.** Non-negotiable per
  Invariant #7. A runaway backfill against millions of rows has to
  abort, not hang.

### Run against dev first

Before touching prod, the user runs the action against their dev
deployment. Ask them to execute:

```bash
npx convex run migrations/001-backfill-lastActiveAt:backfillLastActiveAt
```

That command uses the active dev deployment from `.env.local`
(`CONVEX_DEPLOYMENT` / `NEXT_PUBLIC_CONVEX_URL`). Inspect the returned
`{ totalPatched, totalScanned, pages }`. `totalPatched` should equal the
count of rows that lacked the field before the run.

Re-run the same command — `totalPatched` must be 0. That confirms the
`=== undefined` guard works.

### Run against prod

Prod backfills require explicit consent per Invariant #3. Two gates:

1. The internal action must be deployed to prod first. Merging Phase 2
   to `master` triggers the release workflow which deploys to prod
   Convex.
2. Running the action against prod requires the flag:

```bash
LINEJAM_ALLOW_PROD_CONVEX_SYNC=1 npx convex run \
  migrations/001-backfill-lastActiveAt:backfillLastActiveAt --prod
```

Per Invariant #3, never export `LINEJAM_ALLOW_PROD_CONVEX_SYNC=1` in
your shell rc. Per-command only. Never run the action against prod
without confirming the dev run finished clean first.

### Ship Phase 2

```bash
pnpm typecheck
pnpm ci:prepush
```

Commit message:

```
chore(schema): backfill poems.lastActiveAt

Phase 2 of 3. Paginated internal action with overwrite guard, safe to
re-run. Default: row.createdAt.
```

**Gate:** after the prod backfill action returns clean, `/monitor` 5
minutes. Verify via a read-only Convex dashboard query that
`count(lastActiveAt != null) == count(*)` for the `poems` table. If not
equal, re-run the backfill (the `=== undefined` guard makes this safe)
until it is.

### Phase 2 rollback

Safe by re-run. The action is idempotent. If the default value was
wrong, the rollback is:

1. Revert the migration file and the Phase 1 commit together (leaves no
   trail of the bad backfill for Phase 3 to collide with).
2. If the default value shipped to prod but Phase 3 hasn't landed yet,
   you can also simply re-run a corrected backfill action — patching
   over the bad default. The `=== undefined` guard will skip those rows,
   so the corrected action must use a different guard (e.g.
   `row.lastActiveAt === WRONG_DEFAULT`) to overwrite. File the
   corrective backfill as `NNN+1-*.ts`; don't edit the original.

## Phase 3 — Require

### Edit `convex/schema.ts`

```typescript
// Before (after Phase 1)
lastActiveAt: v.optional(v.number()),

// After (Phase 3)
lastActiveAt: v.number(),
```

Remove the `v.optional(...)` wrapper — that's the whole schema change.

### Typecheck forces read/write call site updates

`pnpm typecheck` will now fail at every site that treated the field as
`T | undefined`. Walk each failure:

- **Read sites**: remove the `?? fallback` / `if (!doc.lastActiveAt)`
  branches. The type is now guaranteed.
- **Write sites**: every `ctx.db.insert('poems', {...})` must include
  the field. Every `ctx.db.patch(..., {...})` that creates a new doc
  semantically must include it.

If a call site needed the fallback for genuine semantic reasons
(ephemeral state, derived value), **abort Phase 3 and reopen Phase 1**
with a richer design. Phase 3 is only safe when the field is universally
populated.

### Ship Phase 3

```bash
pnpm typecheck
pnpm ci:prepush
```

Commit message:

```
feat(schema): require poems.lastActiveAt

Phase 3 of 3. All writes now populate the field; typecheck enforces.
Backfill landed in Phase 2 and the prod grace window closed clean.
```

Merge to `master`. The release workflow deploys prod. The Convex
validator now rejects any write missing `lastActiveAt` — this is the
foreclosure of the original race.

**Gate:** `/monitor` 5 minutes on prod Canary watching for
`Document validation failed` errors tagged to the `poems` table. One or
two stragglers usually indicate a write path the typecheck missed (e.g.
a scheduled action that constructs the insert dynamically). If found,
fix forward with a Phase 1-style revert-to-optional before the errors
compound.

### Phase 3 rollback

**Revert to `v.optional(...)` immediately if reads fail.** Validator
errors on a required field are user-visible crashes — the `useQuery`
error boundary catches them but the page degrades. Phase 3 revert is a
single-line edit in `convex/schema.ts` plus deploy. Don't wait to
diagnose; revert, then investigate.

## ADR emission

Every completed migration gets an ADR. Use
`docs/adr/000-template.md` as the skeleton. Find the next number:

- Check `docs/adr/` for the highest existing `NNNN-` prefix. As of
  2026-04-20 the latest is `0008-pen-names-write-time-capture.md`.
- Next ADR is `NNNN+1`.

File path: `docs/adr/NNNN-<field>-migration.md`. Title:
`ADR-NNNN: <field> three-phase migration`.

Required sections (the template's defaults are fine, but populate these
specifically):

- **Context**: why the field was added, what behavior it enables.
- **Decision**: the schema diff, the default used in Phase 2, the
  invariants now enforced in Phase 3.
- **Consequences**: read/write sites that changed; any data migrations
  beyond the simple backfill.
- **Alternatives Considered**: why not a separate table, why not a
  computed/derived field.
- **Notes**: phase-by-phase deploy log (sha + prod deploy timestamp +
  `/monitor` window outcome for each phase), rollback triggers observed
  (if any).

Existing ADRs follow different conventions on section depth — match the
closest neighbor in `docs/adr/` for stylistic consistency. The pen-names
ADR (`0008-pen-names-write-time-capture.md`) is the closest analog for
schema-field ADRs; the parallel-writes ADR
(`0007-parallel-database-writes.md`) is the closest for mutation-pattern
ADRs.

Ship the ADR in the same PR as Phase 3 so the commit history shows the
migration closing out atomically. Commit message for the ADR:

```
docs(adr): NNNN poems.lastActiveAt three-phase migration
```

## Between phases: the grace window

Canary is the in-grace observer (repo brief, "Canary-first
observability"). `convex/lib/errors.ts` emits structured JSON to the
Convex dashboard AND bridges the client-side errors to Canary via
`components/CanaryClientObserver.tsx`. The signal to watch between
phases:

- **Phase 1 → Phase 2**: `log.error` events tagged with the field name
  in the Convex dashboard. Expect zero — the field is new and optional,
  nothing should be reading it yet.
- **Phase 2 → Phase 3**: Canary + Convex dashboard `Document validation
failed` logs during the backfill action's runtime. Also inspect the
  action's return value — `totalPatched` should plateau on the second
  run (re-idempotence check).
- **Phase 3 → done**: `Document validation failed` tagged to the table.
  Any non-zero count means a write path the typecheck missed.

Use `/monitor` as the watcher. Do not escalate to `/diagnose`
automatically — a single validation error during a Phase 3 grace window
is a legitimate signal that needs human judgment (revert or fix
forward).

The 5-minute default grace window from `/monitor` is correct for most
migrations. Extend only if the migration touches a low-traffic table
where 5 minutes might not exercise all write paths.

## The subtractive test — why this skill is linejam-specific

Applied to another Convex repo, this skill would be wrong because:

- **14 `v.optional()` fields in `convex/schema.ts`**. This is the
  inventory as of 2026-04-20 and the reason the three-phase pattern
  matters here: Linejam has in-flight migrations visible in the schema
  right now (e.g. `lines.authorDisplayName` is a Phase 1 artifact that
  has never been required). A generic skill would assume a clean
  schema.
- **`LINEJAM_ALLOW_PROD_CONVEX_SYNC=1`** is a repo-specific speed bump
  in `scripts/ci/dagger-call.sh`. Other Convex repos don't have it.
- **Canary** is the in-grace observer — not Sentry, not Datadog.
  `convex/lib/errors.ts` + `components/CanaryClientObserver.tsx` are
  the wiring.
- **ADR exemplars live in `docs/adr/`** with existing numbered entries
  `0001–0008`. A generic skill would not know where to file the
  record.
- **`convex/migrations/` is the migration home**, not `convex/` root or
  a separate `migrations/` package. The existing
  `convex/migrations.ts` at the Convex root is the **guest→user
  identity migration** (a one-shot mutation, not a schema backfill) —
  don't confuse it with schema backfills; file under
  `convex/migrations/NNN-*.ts`.

## Delegation

The lead model owns phase decisions and commit boundaries. Dispatch
focused work only:

- **Writing the backfill action**: dispatch `builder`. The contract
  (internal action, paginated, `Promise.all`, termination-guarded
  while loop, `=== undefined` overwrite guard, structured logging) is
  specified above — give the builder this spec verbatim.
- **Reviewing the migration before Phase 2 runs against prod**:
  dispatch `critic` to read the action and confirm idempotence and
  termination. Optionally add `ousterhout` for interface-depth review.
- **Typecheck failures in Phase 3 that reveal a semantic problem**:
  dispatch `planner` — this is a design decision (reopen Phase 1 with a
  richer schema) not a mechanical fix.

Available agents in spellbook: `planner`, `builder`, `critic`,
`carmack`, `ousterhout`, `grug`, `beck`, `a11y-auditor`, `a11y-critic`,
`a11y-fixer`. Do not invent names.

## What /convex-migrate does NOT do

- Drive `pnpm ci:prepush` green after a phase commit fails → `/ci`.
- Diagnose a Convex dashboard error spike after a deploy → `/diagnose`.
- Decide whether a field _should_ be required → that's a design
  question; escalate to `planner`.
- Rename a field → that's a two-field migration (add new, dual-write,
  backfill new, stop writing old, drop old). Each half is a
  `/convex-migrate` invocation in sequence.
- Change an index → schema index changes follow a different dance
  (Convex rebuilds the index in place). File separately.
- Run `convex dev` — Invariant #2.
- Deploy prod Convex casually — Invariant #3.

## Anti-patterns (linejam-specific)

- **Combining Phase 1 and Phase 3 in one PR** ("just flip it to
  required since the field is always set"). The race window is between
  the deploy of the validator change and the last write from the
  pre-change code path. There is no such thing as "always set" in a
  live system mid-deploy. Three phases, always.
- **Skipping Phase 2 because "nobody has old rows"**. The backfill
  action is cheap and its return value is the proof. Run it anyway;
  `totalPatched: 0` is a clean signal, not a waste.
- **Running the backfill against prod before it ran clean against
  dev**. Phase 2 has two runs: dev (verification) and prod (the real
  one). Don't skip the dev run to save a cycle — the cost of a bad
  backfill in prod is much higher.
- **Re-running the backfill to "fix" a bad default**. The
  `=== undefined` guard skips rows that already have the field, so
  re-running won't overwrite a bad value. Write a corrective backfill
  with a different guard, filed as `NNN+1-*.ts`.
- **Exporting `LINEJAM_ALLOW_PROD_CONVEX_SYNC=1` permanently**.
  Invariant #3. Per-command only. The flag in your shell rc removes
  the speed bump entirely.
- **Using `.collect()` inside a backfill mutation**. Convex transaction
  size limits will OOM on any non-trivial table. `paginate` is the
  only safe primitive.
- **Unbounded `while` loop in the action driver**. Invariant #7. The
  `MAX_PAGES` guard is mandatory even if the table is "small today" —
  today's small tables grow.
- **Landing Phase 3 the same day Phase 2 deployed**. The grace window
  between phases is not padding; it's the confirmation that no late
  writer still needs the optional contract. Budget one prod deploy +
  5 minutes of `/monitor` per phase, minimum.
- **Filing the backfill as a `mutation` instead of an
  `internalAction` + `internalMutation` pair**. Mutations can't
  paginate across transactions. A single-mutation backfill works on
  10 rows and explodes on 10,000.
- **Writing the ADR before Phase 3 lands**. The ADR documents the
  migration, not the plan. Defer the ADR commit until the Phase 3
  `/monitor` window closes clean.
- **Skipping the ADR because "it was a trivial one-field change"**.
  There is no such thing — the ADR trail is what future you uses to
  diagnose weird stragglers six months later.

## Output

```markdown
## /convex-migrate Report — poems.lastActiveAt

Phase 1: feat(schema): add optional poems.lastActiveAt
PR #NNN, merged abc1234, prod deploy 2026-04-20T14:12Z.
/monitor 5m clean.

Phase 2: chore(schema): backfill poems.lastActiveAt
PR #NNN+1, merged def5678, prod deploy 2026-04-20T15:03Z.
Backfill run: { totalPatched: 8742, totalScanned: 8742, pages: 88 }.
Re-run verification: totalPatched 0.
/monitor 5m clean.

Phase 3: feat(schema): require poems.lastActiveAt
PR #NNN+2, merged 9abcdef, prod deploy 2026-04-20T16:21Z.
Typecheck revealed 4 read sites, 2 write sites; all updated.
/monitor 5m clean.

ADR: docs/adr/0009-poems-last-active-at-migration.md (landed in PR #NNN+2).
Total elapsed: 2h 09m.
```

On abort mid-phase:

```markdown
## /convex-migrate Report — poems.lastActiveAt — ABORTED at Phase 3

Phase 3 typecheck revealed a read site in `convex/ai.ts:generateLineForRound`
that uses `poem.lastActiveAt ?? Date.now()` as a semantic fallback (not a
migration artifact). The fallback encodes "if the poem has never been
touched, treat it as just-created" — that's a real contract, not a
backfill gap.

Decision required: either (a) populate lastActiveAt at insert time so the
fallback is unreachable (reopen Phase 1 with a write-side change), or
(b) accept the field as semantically optional (revert Phase 3, document
the decision in an ADR, keep the field as v.optional forever).

Escalating to planner.
```

## Related

- `/ci` — drives `pnpm ci:prepush` green after each phase commit.
- `/monitor` — 5-minute grace window watcher between phases.
- `/diagnose` — triage post-deploy anomalies if `/monitor` trips.
- `docs/adr/000-template.md` — ADR skeleton.
- `convex/schema.ts` — source of truth for the data model; 14
  `v.optional()` fields as of 2026-04-20.
- `convex/lib/errors.ts` — structured logging that bridges to Canary.
- `convex/migrations.ts` — the guest→user identity migration, not a
  schema migration. Don't confuse the two.
