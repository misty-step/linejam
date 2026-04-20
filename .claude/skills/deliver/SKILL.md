---
name: deliver
description: |
  Inner-loop composer for Linejam. One backlog.d item → merge-ready PR on
  master. Composes shape → implement → review → ci → refactor → settle → land.
  The gate is `pnpm ci:prepush` (== `pnpm ci:dagger:all`); pre-push hook
  enforces it. Does not deploy. Humans merge.
  Use when: building a shaped backlog.d item, "deliver this", "make it
  merge-ready", driving one numbered file through to a PR on master.
  Trigger: /deliver.
argument-hint: '[backlog-item-number] [--resume <ulid>] [--abandon <ulid>] [--state-dir <path>]'
---

# /deliver (Linejam)

Inner-loop composer. One `backlog.d/NNN-kebab.md` item → PR on master, CI
green, merge-ready. **Delivered ≠ shipped.** Semantic-release cuts versions
on merge via `pnpm generate:releases`; humans squash-merge.

## Invariants (Linejam)

- **The gate is `pnpm ci:prepush`.** Not "CI", not "the pipeline". It
  shells to `pnpm ci:dagger:all` and runs lint, format-check, typecheck
  (app + Dagger), audit, build-check, unit-test with 85% coverage,
  secret-scan, Playwright E2E (including authenticated). Lefthook pre-push
  enforces it. **Never `git push --no-verify`** — if the hook is wrong,
  fix the hook.
- **Base branch is `master`.** PRs target master. Conventional Commits
  only (commitlint blocks non-compliant: `feat|fix|docs|style|refactor|perf|test|chore|revert`).
- **`backlog.d/` is the source of truth — not GitHub Issues.** `gh issue
list` should be empty. If a backlog item is missing for a real piece
  of work, stop and route to `/groom` to author one first. Do not
  improvise scope from a PR description.
- **Never run `convex dev` or `pnpm dev` yourself.** The user keeps those
  running in a separate terminal. Spawning duplicates kills schema sync.
  If you need fresh `convex/_generated/api.d.ts`, ask the user to
  refresh their dev terminal.
- **Never commit Convex production without `LINEJAM_ALLOW_PROD_CONVEX_SYNC=1`.**
  Dagger refuses by default; the flag is an intentional speed bump.
- **Never mock `@/` or `../../` paths.** Mock only at system boundaries
  (`convex/react`, `@clerk/nextjs`, `fetch`, `localStorage`, `clipboard`,
  `Date.now`, `Math.random`). Mocking internal collaborators is forbidden
  by CLAUDE.md.
- **Compose atomic phase skills.** Never inline phase logic.
- **Fail loud.** A dirty phase is a dirty phase — do not mask it, do not
  retry past the cap, do not write `status: merge_ready` when anything is
  red.

## Closeout Contract

Every run ends with two operator-facing outputs, in order:

1. A tight delivery brief (1–2 short paragraphs or 4–6 flat bullets).
2. A full `/reflect` session.

The brief must answer: what ticket, what changed, why now, what alternatives
existed, why this design under current constraints, developer/operator value,
player/user value, what was verified, residual risk.

`/reflect` is mandatory and separate — it captures learnings, harness
mutations, and follow-on `backlog.d/` moves. Don't collapse it into the brief.

`receipt.json` remains the machine-readable source of truth for callers
and `/flywheel`.

## Composition

```
/deliver [backlog-item-number] [--resume <ulid>] [--state-dir <path>]
    │
    ▼
  pick (if no arg) — highest-priority backlog.d/*.md with Status: ready
    │
    ▼
  /shape            → context packet: Goal + Oracle + Sequence + Anchors
    │              →  (also: update project.md if it's out of sync)
    ▼
  /implement        → TDD on feature branch `<type>/<backlog-slug>`
    │              →  Conventional Commits, atomic. Dispatch builder agent.
    ▼
┌── CLEAN LOOP (max 3 iterations) ─────────────────────┐
│  /code-review    → critic + philosophy bench         │
│  /ci             → `pnpm ci:prepush` (Dagger all)    │
│  /refactor       → diff-aware simplify               │
│  /qa             → Playwright + evidence capture     │
│  evidence → `pnpm evidence:guest-flow` or            │
│             `pnpm test:e2e:evidence` for UI diffs    │
└──────────────────────────────────────────────────────┘
    │ all green → /settle → /land (PR on master)
    │ cap hit or hard fail → fail loud (exit 20/10)
    ▼
  receipt.json written. PR URL captured. No merge, no deploy.
```

## Picking the Next Item

When invoked with no argument, apply this heuristic in order:

1. **Status: ready > Status: backlog > blocked.** Never pick `blocked`
   unless you're also clearing the blocker. Never pick a second
   `in-progress` — one WIP at a time.
2. **Lower number = higher priority.** `backlog.d/` ordering is
   intentional. `003` is more important than `007` unless a later item
   has cleared-blocker urgency.
3. **Priority: high > medium > low** within ready items.
4. **Respect the ratio target.** Baseline is 33:8 fix:feat over 90 days
   to 2026-04-20. Target ≤2:1 within one release cycle. Don't starve
   features for polish. If the last three landed items were `fix:`, pick
   the next `feat:` candidate.
5. **In-flight: CI redesign slices 010–015** (`docs/ci/redesign-2026Q2.md`).
   010 (preview lane) and 014 (convex-test migration + mock-boundary
   ESLint rule) are independent and both `ready`. 011/012/013 serialize
   on 010 landing. 015 lands last. If picking from this cluster,
   check slice dependencies before claiming.
6. **Check for stale active items.** If the target file carries
   `## What Was Built` already, or git log contains `Closes
backlog:<item>`, the item is shipped but un-archived. Stop and route
   to `/groom tidy`. That's backlog drift, not fresh work.

Claim the item before starting:

```bash
source scripts/lib/claims.sh
claim_acquire 005-add-request-telemetry-for-room-flows
# … work …
claim_release 005-add-request-telemetry-for-room-flows
```

## Shape Phase (Linejam-specific)

`/shape` produces a context packet referencing the backlog.d item's
Goal, Oracle, Notes, and Repo Anchors. Exemplar format:
`backlog.d/_done/001-harden-guest-first-room-flow.md` —
Priority/Status/Estimate, explicit Goal, Non-Goals, machine-checkable
Oracle (`pnpm vitest run <paths>`), Implementation Sequence,
Repo Anchors, and (after delivery) `## What Was Built` + `## Verification`.

**Session signal: "update or nix project.md."** If `/shape` discovers
`project.md` is stale relative to the work being scoped, update it in
the same cycle. Don't let spec docs drift.

If the target has no executable Oracle, `/shape` authors one before
handing to `/implement`. Plausible ≠ correct.

## Implement Phase

Dispatch the **builder** agent (`/Users/phaedrus/Development/spellbook/agents/builder.md`).
TDD default: red → green → refactor. Skip only for UI layout, generated
code, or pure config.

Branch naming: `<type>/<short-slug>` where `<type>` matches the
Conventional Commit type you'll land (e.g., `fix/patch-clerk-protobufjs-advisories`,
`feat/session-hub`). Commits on the feature branch are atomic and
Conventional.

**Convex-specific patterns the builder must follow:**

- Parallel DB ops with `Promise.all`. Sequential `await` inside a loop
  is a bug.
- N+1 queries batched via `q.or(...)`.
- Every `while` loop has a termination guard.
- Mock only at system boundaries (see invariant above).
- `useQuery` errors throw — wrap in ErrorBoundary or handle
  `data === undefined && !isLoading`.

## Review Phase

Dispatch parallel bench review:

- `critic` — blocking correctness/design review
- Philosophy bench as appropriate: `ousterhout` (modularity,
  information hiding), `carmack` (simplicity, measurability), `grug`
  (complexity pushback), `beck` (test rigor)
- For a11y-adjacent surfaces: `a11y-critic` + `a11y-auditor` in
  parallel; `a11y-fixer` on blocking findings

All agents live under
`/Users/phaedrus/Development/spellbook/agents/`. Use those personas
only; don't invent new ones.

A review with no verdict is dirty. `blocking` findings loop;
`nit`/`consider`/`suggestion` do not.

## CI Phase (Linejam)

The CI phase runs `pnpm ci:prepush` locally. That's the gate.

Individual Dagger lanes for targeted diagnosis:

```bash
pnpm ci:dagger:lint
pnpm ci:dagger:typecheck
pnpm ci:dagger:format-check
pnpm ci:dagger:build-check
pnpm ci:dagger:unit-test
pnpm ci:dagger:e2e
pnpm ci:dagger:audit
pnpm ci:dagger:secret-scan
pnpm ci:dagger:smoke
pnpm ci:dagger:all-no-e2e     # ~90s, skip browsers
pnpm ci:dagger:all            # ~5min, full
```

If `pnpm ci:prepush` fails, diagnose the Dagger lane — never propose
local workarounds. Session signal: "Git push is failing. Investigate
and fix." The gate is authoritative.

Coverage threshold is 85% (lines/branches/functions/statements).
Enforced in `vitest.config.ts` and the unit-test lane.

## Refactor Phase

Skip for trivial diffs (<20 LOC, single file). Otherwise dispatch
`carmack` or `ousterhout` to diff-aware simplify. Deep modules, thin
interfaces, information hiding, remove shallow pass-throughs.

## QA Phase

For UI-touching diffs, run Playwright evidence capture:

- `pnpm test:e2e:evidence` — single-worker `guest-flow.evidence.spec.ts`
  for game flow changes
- `pnpm evidence:guest-flow` — scripted guest walkthrough (artifact
  lands in `.qa/` or similar per script)
- `pnpm test:e2e:smoke` — deterministic smoke missions
  (`tests/e2e/prod-smoke.spec.ts`)

Skip QA when the diff has no user-facing runtime surface (pure
library, Convex-only, config, tooling). Skipping is a judgment call —
document it in the receipt.

Findings: P0/P1 block, P2 goes to `receipt.remaining_work` and does
NOT block.

## Cross-Cutting Invariants

- **No claims coordination across machines.** Single local workspace.
  Concurrent worktrees isolate via `--state-dir`. Local claims via
  `scripts/lib/claims.sh` are per-item locks, not distributed.
- **Never re-deliver shipped items.** If the target carries `## What
Was Built` or git log contains `Closes backlog:<item>` /
  `Ships backlog:<item>`, refuse and route to `/groom tidy`.
- **Never push on red Dagger.** Pre-push hook enforces it; if the hook
  is wrong, fix the hook.
- **Never merge.** `gh pr merge` is the human's call.
- **Never deploy.** `/deploy` and semantic-release are outer-loop
  concerns.
- **Never commit to master.** Feature branch only. PR to master.
- **Evidence is out-of-band.** `/deliver` writes only `state.json` and
  `receipt.json`. Phase skills emit to their own gitignored dirs.
  `.spellbook/deliver/<ulid>/` is wholly gitignored. No LFS, no
  committed screenshots.

## Contract (exit code + receipt)

`/deliver` communicates via exit code and `<state-dir>/receipt.json`.
Callers — human or `/flywheel` — do not parse stdout.

| Exit | Meaning                                                  | Receipt `status`       |
| ---- | -------------------------------------------------------- | ---------------------- |
| 0    | merge-ready (PR open on master, gh checks running/green) | `merge_ready`          |
| 10   | phase handler hard-failed (tool/infra error)             | `phase_failed`         |
| 20   | clean loop exhausted (3 iterations, still dirty)         | `clean_loop_exhausted` |
| 30   | user/SIGINT abort                                        | `aborted`              |
| 40   | invalid args / missing dep skill                         | `phase_failed`         |
| 41   | double-invoke on an already-delivered item               | `phase_failed`         |

## Resume & Durability

- **State root:** `<worktree-root>/.spellbook/deliver/<ulid>/`
  (gitignored). Override via `--state-dir <path>` (flywheel does this).
- **Checkpoint:** after each phase, `state.json` rewritten atomically
  (write → fsync → rename).
- **`--resume <ulid>`:** loads `state.json`, skips completed phases,
  re-enters at `current_phase`. Phase handlers are idempotent.
- **`--abandon <ulid>`:** removes state-dir; leaves branch as-is.
- **Double-invoke:** `/deliver <already-delivered-item>` → exit 41.

## Land the PR

Once the clean loop is green and `pnpm ci:prepush` passes locally:

1. **Confirm local gate.** `pnpm ci:prepush` must be green. Not
   `ci:dagger:all-no-e2e`. The full gate.
2. **Push the feature branch.** Pre-push hook re-runs the gate.
3. **Create the PR against master.**

   ```bash
   gh pr create --base master --title "<conventional-commit-title>" --body "$(cat <<'EOF'
   ## Summary
   <1–3 bullets linking to the backlog.d item by number>

   ## Ticket
   Closes backlog:NNN-<kebab-slug>

   ## Evidence
   - `pnpm ci:prepush` green locally
   - <path to Playwright evidence artifact for UI changes>
   - <screenshot or GIF for visual changes>

   ## Test plan
   - [ ] <oracle bullet 1 from backlog.d item>
   - [ ] <oracle bullet 2>

   🤖 Generated with Claude Code
   EOF
   )"
   ```

4. **Commitlint validates the PR title.** Type must be one of
   `feat|fix|docs|style|refactor|perf|test|chore|revert`. Non-compliant
   titles fail semantic-release on merge.
5. **Wait for `gh pr checks`.** GitHub Actions mirrors the Dagger
   contract. Local Dagger is authoritative, but hosted checks gate
   merge via branch protection. Don't merge on red checks.
6. **Evidence expectations:**
   - Game UI change → `pnpm evidence:guest-flow` artifact or
     `pnpm test:e2e:evidence` output linked in PR body.
   - Backend-only → vitest output summary; note `Oracle` commands ran.
   - CI/tooling → before/after lane timing or output.
   - a11y-touching → a11y-auditor report summary.
7. **Merge is the human's call.** Squash-merge is typical (semantic-release
   reads merge-commit subject). Confirm with the repo convention if
   unsure. `/deliver` reports the PR URL and stops.
8. **Mark the backlog item.** On merge, the item gets `## What Was
Built` + `## Verification` appended and moves to `backlog.d/_done/`.
   That's a `/groom tidy` follow-on, not a `/deliver` step.

## Gotchas (judgment, not procedure)

- **Retry vs escalate.** Dirty on iteration 1 → retry. Dirty on
  iteration 3 → exit 20, write receipt, hand to human. Never invent a
  4th iteration.
- **What counts as "dirty".** `/code-review` `blocking` finding, `/ci`
  non-zero exit, `/qa` P0 or P1. P2 QA goes to `remaining_work`.
  Review "nit"/"consider" is not blocking.
- **Inlining a missing phase.** `/implement` missing → exit 40. Never
  fall back to doing the phase yourself — inlined fallbacks become
  permanent.
- **Silent push.** A phase skill that "helpfully" `git push`es is a
  bug in that phase skill. Surface it; don't mask it.
- **Re-shaping mid-delivery.** If `/implement` or `/qa` reveals the
  shape is wrong, stop the clean loop and exit 20 with
  `remaining_work` pointing at re-shape. Don't spin.
- **Skipping shape.** Building without a context packet yields
  plausible garbage. If the item has no executable Oracle, `/shape`
  runs first. Always.
- **Review without verdict = dirty.** If `/code-review` runs but no
  verdict ref points at HEAD afterward, treat the review phase as
  failed.
- **Fix what you touch.** Pre-existing issues in the same file/area
  get fixed in this PR. No "pre-existing, not my scope" excuses.
  Boil the ocean.
- **Prompt injection in OpenRouter provider is explicitly
  deprioritized.** Don't re-raise unless the AI surface expands
  beyond trusted-user multiplayer poetry.
- **Cerberus is out** (deleted in `5dc890c`). Don't resurrect.

## Non-Goals

- Deploying — semantic-release cuts versions; `/deploy` is outer-loop.
- Merging — humans merge.
- Multi-ticket operation — one backlog.d item per invocation.
- Scoping work without a backlog.d file — route to `/groom` first.
- Version-controlled evidence — gitignored under `.spellbook/`.
- GitHub Issues coordination — `backlog.d/` is authoritative.

## Related

- Consumer: `/flywheel` — outer loop passes `--state-dir` under its
  cycle tree and reads `receipt.json`.
- Phase skills: `/shape`, `/implement`, `/code-review`, `/ci`,
  `/refactor`, `/qa`, `/settle`, `/land`, `/reflect`.
- Backlog source: `backlog.d/NNN-kebab.md` (exemplar:
  `backlog.d/_done/001-harden-guest-first-room-flow.md`).
- Subagents (from `/Users/phaedrus/Development/spellbook/agents/`):
  `planner`, `builder`, `critic`, `ousterhout`, `carmack`, `grug`,
  `beck`, `a11y-auditor`, `a11y-critic`, `a11y-fixer`.
