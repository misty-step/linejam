---
name: flywheel
description: |
  Outer-loop shipping orchestrator for linejam. Composes /deliver → land
  to master → /deploy (auto via Vercel + Convex on master push) →
  /monitor (grace window on /api/health + Canary readiness) → /reflect
  cycle per `backlog.d/NNN-*.md` item, then applies reflect outputs to
  backlog and harness before looping. Gated at each stage by
  `pnpm ci:prepush` green.
  Use when: "flywheel", "run the outer loop", "next N items",
  "overnight queue", "cycle".
  Trigger: /flywheel.
argument-hint: '[--max-cycles N]'
---

# /flywheel

Compose cycles of: **pick a `backlog.d/NNN-*.md`** → `/deliver` →
land PR to `master` → `/deploy` (auto via master push) → `/monitor`
(grace window) → `/reflect cycle` → apply reflect outputs → loop.

You already know how to do each leaf. This skill only encodes the
linejam-specific invariants that aren't inferable from the leaf names.

## Cycle shape

```
pick item  →  /deliver      (shape → implement → review → ci → refactor)
           →  settle / land (gh pr merge --squash --delete-branch; master)
           →  /deploy       (Vercel + Convex auto; Fly responder manual)
           →  /monitor      (/api/health + Canary readiness grace window)
           →  /reflect cycle
           →  apply reflect (backlog mutations + harness branch)
           →  loop
```

## Picking the next item

Source of truth is `backlog.d/` (Invariant #10 — never GitHub Issues).
Rank:

1. **Status**: `ready` > `backlog`. Never claim an in-progress item.
2. **Priority**: P0 > P1 > P2 > P3.
3. **Blockers**: every upstream must already be in `backlog.d/_done/`.
4. **Slice awareness** — CI redesign slices 010–015 from
   `docs/ci/redesign-2026Q2.md`:
   - **Parallel-eligible**: 010 (preview lane) and 014 (convex-test +
     mock-boundary ESLint rule) are structurally independent — safe to
     run concurrently in separate worktrees.
   - **Serialized**: 011/012/013 block on 010. 015 lands last.
5. **Ratio discipline**: target ≤2:1 fix:feat within one release cycle
   of slice 015 landing. If the last 5 cycles were all `fix:`, bias
   toward a `feat:` pick even at equal priority.

Skip items explicitly deprioritized in memory (e.g., prompt injection
in `convex/lib/ai/providers/openrouter.ts` — user said "idc about
prompt injection here really"; do not resurrect unless the AI surface
expands beyond trusted-user multiplayer poetry).

## Invariants

- **Flywheel composes, leaves own phase logic.** `/deliver`'s
  `receipt.json` is the contract — do not peer inside it.
- **Gate is `pnpm ci:prepush`.** Lefthook pre-push enforces. Never
  advance past `/deliver` on red Dagger; never `--no-verify`
  (repo-brief Invariant #1).
- **Land before deploy.** Always. `/deploy` runs after the squash-merge
  hits `master` (which triggers Vercel + Convex auto-deploy via
  `pnpm build` = Convex bootstrap + `next build`).
- **Convex prod speed bump stays.** Push-to-master runs
  `scripts/ci/bootstrap-convex-env.mjs`, which refuses prod without
  `LINEJAM_ALLOW_PROD_CONVEX_SYNC=1` (Invariant #3). Flywheel never
  sets this flag silently.
- **Canary placeholders fail closed** (Invariant #4). Any build-bearing
  lane abort on missing real `NEXT_PUBLIC_CANARY_*` = stop the cycle
  and surface to the human.
- **Reflect mutations close within the cycle.** Backlog state flips
  (`ready` → `_done/`) commit on the shipped branch. Harness edits
  (`.claude/skills/*`, `AGENTS.md`, `settings.local.json`) land on a
  separate harness branch (e.g. `harness/reflect-<cycle-ulid>`) and
  **never touch `master` in-cycle** — the human promotes them.
- **State on disk only.** `backlog.d/`, git refs, each leaf's receipt.
  No in-memory cycle state.

## Abort triggers

Stop the loop and surface to the human when:

- **Two consecutive `/deliver` failures on the same item** → misshapen
  spec; route to `/groom` or `/ceo-review`.
- **`/monitor` trip during grace window** → hand off to `/diagnose`
  with the signal payload. Trip conditions: Canary event burst >10/hr
  (per CLAUDE.md alert rules), `/api/health` 5xx, or new-issue
  first-occurrence email.
- **`merge-gate` red after local pre-push green** → hosted CI caught
  something local Dagger missed. Do **not** retry the local gate
  expecting different output; route the lane to `/diagnose` (see
  Gotcha #8: Playwright flake = Clerk smoke-account drift OR Convex
  dev out-of-sync with branch).
- **Ratio breach**: cycle would push fix:feat beyond 3:1 and picker
  keeps selecting `fix:` → pause, `/groom`.

## Parallelism

Two `/flywheel` runs in the same worktree collide on git state. For
parallel cycles (canonical example: slice 010 + slice 014 concurrently):

- Create a second worktree: `git worktree add ../linejam-slice-010 <branch>`.
- Each worktree runs its own `pnpm ci:prepush`. Dagger container
  volumes cache per worktree path by default — safe.
- **Convex dev deployment is singleton.** Preview lane runs against
  the shared dev deploy, so do not schema-diverge in both worktrees
  simultaneously. Two `feat(schema):` items in parallel flywheels = a
  collision; serialize them.

## Apply-reflect step

After `/reflect cycle` produces outputs:

1. **Backlog mutations** (new items, status flips, de-prioritizations):
   commit on the shipped branch before PR merges. If the PR is already
   landed, follow up with `chore(backlog): <summary>` on a new branch.
   New items: `backlog.d/NNN-kebab.md` with Goal + Oracle — never
   `gh issue create`. No TODO comments in code (CLAUDE.md bans).
2. **Harness-branch mutations**: push to `harness/reflect-<ulid>`. Do
   not merge into `master` inside the cycle. Human promotes after
   review.
3. **Session-signal codification**: if reflect surfaces a recurring
   user correction, route it to `feedback_*.md` in auto-memory
   (/Users/phaedrus/.claude/projects/-Users-phaedrus-Development-linejam/memory/),
   not to code.

## Gotchas

- An item may be `ready` in `backlog.d/` but already shipped in git.
  Before claiming, check `git log --grep '<item-slug>'` and
  `backlog.d/_done/`. Move stale entries to `_done/` first with a
  `chore(backlog):` commit.
- `/deploy` is nominally manual but push-to-master is the production
  mechanism for Vercel + Convex. Flywheel's "deploy" stage is often
  just: wait for Vercel + Convex auto-deploy + capture receipt
  (sha, version, URL). Fly responder re-deploy is manual (`fly deploy`
  with `fly.responder.toml`) — only needed when `scripts/canary/*` or
  `Dockerfile.responder` change.
- OpenRouter cost telemetry from AI-player generation may surface in
  reflect outputs. Ignore unless burn-rate exceeds baseline — this is
  multiplayer poetry, not high-volume LLM ops.
- **Cerberus is out** (commit `5dc890c`). Do not resurrect despite any
  appearance in old transcripts or logs.

## Non-Goals

- No cycle state machine, event enum, lock, or pick-scoring algorithm.
  Priority + status + blocker-closure is enough.
- No USD tracking — runs under Claude subscription.
- No auto-triggering — flywheel is invoked (human or `/loop`), never
  self-scheduled from within.
