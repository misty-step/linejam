---
name: settle
description: |
  Unblock, polish, and land PRs in linejam. Primary mode is GitHub (PRs target
  master). Take a branch from blocked to merged under the `pnpm ci:prepush`
  Dagger gate and the `merge-gate` branch-protection check. Plain `/settle`
  stops at merge-ready; `/land` continues through a squash merge with branch
  deletion.
  Use when: PR is blocked, CI red, `merge-gate` failing, review comments open,
  "land this", "get this mergeable", "address reviews", "unblock", "fix CI",
  "git push is failing".
  Trigger: /settle, /land (alias), /pr-fix, /pr-polish.
argument-hint: '[PR-number|branch-name]'
---

# /settle

Take a linejam branch from blocked to merged. Operate in the repo's actual
contract, not a generic one:

- **Base branch**: `master`. All PRs target master.
- **Authoritative gate**: `pnpm ci:prepush` (= `pnpm ci:dagger:all`). Lefthook
  pre-push enforces. **Never `--no-verify`** (Invariant #1). If the hook says no,
  fix the Dagger lane, not the hook.
- **Commitlint**: Conventional Commits enforced at commit-msg via
  `@commitlint/config-conventional`. Allowed types: `feat`, `fix`, `docs`,
  `style`, `refactor`, `perf`, `test`, `chore`, `revert`.
- **Branch protection**: the required status check is the rollup job named
  `merge-gate` in `.github/workflows/ci.yml`. It depends on `quality-gates`,
  `test-build`, and `e2e`. Nothing lands without it green.
- **Merge policy**: **squash** for human single-ticket branches (the recent
  `(#N)` linear history in `git log` is the ground truth — e.g. #196, #201,
  #208–#213). Dependabot PRs are the only common exception (true merge). Use
  squash unless you have an explicit reason not to.
- **No `scripts/lib/verdicts.sh` here.** Linejam has no verdict-ref mechanism —
  `scripts/lib/` contains only `claims.sh`. Ignore git-native/verdict flows
  from the upstream spellbook skill; they do not apply in this repo.

## Role

Senior engineer owning the lane end-to-end. "Done" means merged, not "CI
green." Not merged until architecturally sound, well-tested, simple, and the
branch is deleted after land.

## Execution Stance

Executive orchestrator.

- Keep review-comment disposition, risk tradeoffs, hindsight calls, and
  merge-readiness judgment on the lead.
- Delegate bounded remediation to focused subagents — one failing check, one
  comment thread, one narrow patch at a time.
- Parallel fanout when fixes are independent; serialize when they share files
  or collide on `merge-gate` inputs.
- Compose `/ci`, `/code-review`, and `/refactor`; do not reinvent their
  contracts.

## Mode

Linejam is a GitHub-hosted repo with an active PR workflow. `/settle` assumes
GitHub mode:

1. If `$ARGUMENTS` matches `^[0-9]+$` → that PR number.
2. Else `gh pr view` for the current branch → that PR.
3. Else: if the user says "land this" or "settle this" with no PR, the first
   action is `gh pr create --base master` (squash-target). Then resume below.

There is no git-native fallback in this repo. If you reach for a verdict ref,
stop — that flow does not exist here.

## Known-Debt Guardrails

Before touching anything, ground yourself in the current checkout rather than
stale harness lore:

- `003` tracks the missing bootstrap/setup path. Do not assume
  `scripts/setup.sh` or setup docs already exist.
- `004` tracks missing governance docs (`CODEOWNERS`, `SECURITY.md`,
  `CONTRIBUTING.md`). A PR adding or updating those files is real product
  work, not noise.
- `005` is the active telemetry debt around health, guest-session, and room
  entry flows.
- `006` is still marked `blocked` in `backlog.d/`. If a PR claims to ship
  that item, verify the blocker story in the file itself before landing it.
- `007` is the current high-priority ready item; agentic QA work should point
  there, not to uncommitted redesign slices.
- **Cerberus is out** (workflow deleted in `5dc890c`). Do not resurrect it in
  any "fix the CI" patch.

## Process

### Phase 1: Fix — Unblock

Read `references/pr-fix.md` and follow it fully. Goal: blocked → green under
`merge-gate`.

1. **Conflicts** — rebase onto `master` (or merge). Resolve every conflict.
   Generated files (`convex/_generated/api.d.ts`) will regenerate on
   `pnpm dev:convex` / `pnpm build` — do not hand-reconcile them.
2. **Local Dagger first** — invoke `/ci`. `pnpm ci:prepush` is the
   source-of-truth gate; hosted `merge-gate` is secondary confirmation. If
   local is green and hosted is red, diagnose the remote lane (commonly
   Clerk smoke-account drift or Convex dev deployment out-of-sync) — do not
   propose local workarounds. **"Git push is failing" never means bypass the
   hook; it means diagnose the Dagger lane.**
3. **Remote checks** — `gh pr checks <N>` and `gh pr view <N> --json statusCheckRollup`.
   Triage by job:
   - `quality-gates` red → `/ci` locally, fix, push.
   - `test-build` red → `pnpm ci:dagger:unit-test` or `pnpm ci:dagger:build-check`.
   - `e2e` red → `pnpm ci:dagger:e2e`. E2E flake is usually Clerk or Convex
     drift (see brief §Gotchas); investigate those before blaming the test.
   - `qa-evidence` red → advisory, not merge-blocking. Note it; do not hold
     the land on it unless the user asks.
   - `merge-gate` red but all dependencies green → stale; re-run it.
4. **Self-review** — read the full diff (`gh pr diff <N>`) as a reviewer.
   Flag: shallow pass-throughs, `while` loops without termination guards
   (Invariant #7), sequential DB writes that should be `Promise.all`
   (Invariant #6), mocks of `@/` or `../../` paths (Invariant #5).
5. **Review findings** — fetch full bodies via
   `skills/settle/scripts/fetch-pr-reviews.sh <N>`. Do not read 300-char
   previews from `gh pr view`. For each finding: fix (in scope), defer
   (file a `backlog.d/NNN-*.md` with Goal + Oracle — Invariant #10, backlog
   is authoritative, not GH Issues), or reject with steelmanned reasoning.
6. **Commit messages** — every commit must pass commitlint. If an in-branch
   commit has a bad type, fix with `git rebase -i <base>` and edit the
   offending commit's message. Never use `--no-edit`. Never `--no-verify`.
   Squash-merge will produce one canonical commit at land-time, but in-flight
   commits still gate the push hook.
7. **Async settlement** — after pushing fixes, wait on `merge-gate` and any
   bot reviewers. Re-check via `gh pr view --json statusCheckRollup,reviews`.
   Do not declare "unblocked" while checks are still running.

**Exit gate:** `merge-gate` green, every review finding dispositioned (fix /
defer-with-backlog-entry / reject-with-reasoning), at least one approving
review (or explicit user override for solo branches).

### Phase 2: Polish — Elevate quality

Read `references/pr-polish.md`. Goal: works → exemplary.

1. **Hindsight review** — would we build it the same way starting over?
   Look for shallow modules, pass-through layers, hidden coupling, temporal
   decomposition, premature abstractions, tests that assert implementation
   instead of behavior.
2. **Agent bench** — invoke `/code-review`. For architecture-weighted diffs,
   dispatch `ousterhout` (module depth, information hiding), `carmack`
   (simplicity, data flow), and `grug` (complexity demons) in parallel as
   Explore-type subagents. For test-heavy diffs add `beck` (TDD discipline).
   Address every `fail` before proceeding.
3. **Architecture edits** — fix what the bench surfaces. Commit with the right
   Conventional Commit type (`refactor:` if behavior is preserved; `fix:` if
   a latent bug is patched).
4. **Test audit** — coverage gaps, brittle tests, missing edge cases.
   Coverage threshold is **85%** (enforced in `vitest.config.ts` and the
   unit-test Dagger lane). Do not mock internal collaborators (Invariant #5).
5. **Docs** — if the diff changed behavior that `CLAUDE.md`, `project.md`,
   `docs/adr/`, or repo-brief anchors describe, update them in the same PR.
   "Update or nix project.md" is a recurring session correction — track
   current state immediately, not lazily.
6. **Confidence** — state explicitly: what's covered, what isn't, what the
   residual risk is. Confidence is a deliverable, not a vibe.

**Exit gate:** architecture clean per bench, tests solid, docs current,
confidence stated. If polish generated commits, return to Phase 1.

### Phase 3: Refactor — Reduce complexity

Invoke `/refactor` for this branch.

**Mandatory when diff > 200 LOC net.** For smaller diffs, manual module-depth
review using Ousterhout checks (shallow modules, info leakage, pass-throughs,
dead compatibility shims).

1. Run `/refactor` with base auto-detection (`master`). Pass `--base master`
   only if auto-detect is ambiguous.
2. Pick one bounded change: deletion > consolidation > state reduction >
   naming > abstraction.
3. Implement, run `pnpm test` (or `pnpm ci:dagger:unit-test`), commit.
4. Validate: complexity must be _removed_, not _moved_. If the diff simply
   relocates code, it does not count.

**Exit gate:** nothing obvious left to remove, or explicit justification for
keeping what remains. Commits here re-enter Phase 1.

## Loop

```text
Phase 1 (fix) → Phase 2 (polish) → Phase 3 (refactor)
       ↑                                      │
       └──────── if changes pushed ───────────┘
```

Terminates when a full pass produces no commits and `merge-gate` is green.

## /land — the landing mode

`/land <PR>` (or on the current branch's PR) is the same skill with merge
enabled at the end.

Preconditions (verify in this order, stop on first failure):

1. **Local Dagger is green**: `pnpm ci:prepush` clean on HEAD.
2. **Remote `merge-gate` is green**: `gh pr view <N> --json statusCheckRollup`
   shows `merge-gate` SUCCESS. All dependent jobs (`quality-gates`,
   `test-build`, `e2e`) likewise. `qa-evidence` is advisory — a failing
   `qa-evidence` does not block, but note it.
3. **Review approved**: at least one approving review, or explicit user
   override for solo branches.
4. **No unresolved review threads**: every finding has been dispositioned.
5. **Backlog drift check**: if this PR claims a numbered backlog item or
   updates `backlog.d/`, verify that the referenced item exists in this
   checkout and that its blocker/status story still matches the file on disk.

Then land:

```bash
gh pr merge <N> --squash --delete-branch
```

`--squash` matches the repo convention for single-ticket branches (see the
`(#N)` suffix on recent merges like #196, #201, #208–#213). `--delete-branch`
removes the remote branch after land. For Dependabot PRs only, `--merge` is
acceptable if you need to preserve the dependency-bump audit trail — but
`--squash --delete-branch` is the default answer.

After land:

```bash
git checkout master && git pull --ff-only
git branch -d <branch>   # local cleanup; -d not -D
```

Verify: `gh pr view <N> --json state,mergedAt` shows `MERGED`. If master is
now broken (post-merge CI red on master), you own the fix — roll forward with
a `fix:` commit; do not revert without discussing with the user.

## Reviewer Artifact Policy

When settlement needs screenshots, GIFs, logs, or walkthrough proof:

- Upload to draft GitHub release assets; embed the asset URLs in PR comments.
  Private-repo `raw.githubusercontent.com` URLs break — do not use them.
- Convert `.webm` → `.gif` before upload (GitHub renders GIFs inline; videos
  require a click).
- `qa-evidence` is a real CI job: it uploads `qa-evidence`,
  `qa-evidence-test-results`, and `qa-evidence-server-log` as 14-day artifacts.
  Prefer linking those to re-capturing locally.
- Never commit binary evidence directly to git. Canary webhook receipts
  belong in Canary, not the PR diff.

## Subagent Dispatch (allowed roster)

Only these configured agents are available:

- `a11y-auditor`, `a11y-critic`, `a11y-fixer` — accessibility triad. Use when
  the diff touches `app/`, `components/`, or any rendered UI.
- `beck` — TDD discipline, test quality.
- `builder` — TDD-disciplined implementation for bounded fixes.
- `carmack` — simplicity, data flow, performance intuition.
- `critic` — adversarial code review.
- `grug` — complexity-demon hunting.
- `ousterhout` — module depth, information hiding, shallow-module detection.
- `planner` — design decisions that need a plan before a patch.

Dispatch pattern: parallel fanout for independent review lenses (e.g. Phase 2
bench = ousterhout + carmack + grug as Explore-type, concurrent); serial when
outputs feed inputs (e.g. planner → builder).

Do not invent agents. If a role isn't in the list above, use a general-purpose
ad-hoc subagent with an objective, an output format, and explicit bounds.

## Anti-Patterns

- **`git push --no-verify`** or any bypass of the pre-push Dagger hook. Invariant #1.
  If the hook is wrong, fix the Dagger lane.
- **"Works locally, push anyway."** Hosted `merge-gate` is the branch-protection
  check. If local is green and hosted is red, the remote lane is the bug.
- **"Git push is failing, let me work around it."** Session signal from the
  user is explicit: diagnose the Dagger lane, don't work around it.
- **Reading 300-char review previews.** Always fetch full bodies via
  `skills/settle/scripts/fetch-pr-reviews.sh <N>`.
- **Reflexive dismissal** of automated reviewer comments ("by design",
  "existing pattern") without steelmanning. Criteria in `references/pr-fix.md`.
- **Batch-reply without fixing.** One inline reply per thread, with a concrete
  disposition (fix / defer-with-backlog-entry / reject-with-reasoning).
- **Declaring done while checks are running.** Wait for `merge-gate`.
- **Polish without re-running `/ci`.** Every commit changes the gate inputs.
- **Refactoring without preserving behavior.** Tests must stay green.
- **Merging from plain `/settle`.** `/settle` ends at merge-ready. `/land`
  does the merge.
- **`--merge` or `--rebase` for human single-ticket PRs.** Squash is the
  convention. Deviate only with cause.
- **Forgetting `--delete-branch`.** Branches accumulate. Always delete after
  squash-land.
- **Filing deferred findings as GitHub Issues.** Backlog is `backlog.d/` —
  Invariant #10. As of 2026-04-20 there are zero open GH issues and that is
  intentional.
- **Resurrecting Cerberus.** The workflow was deleted in `5dc890c`. It is not
  coming back.
- **Mocking `@/` or `../../` paths** to make tests pass during settle.
  Invariant #5. Use the real collaborator.

## Output

Report per phase:

- **Fix:** conflicts resolved, local `pnpm ci:prepush` status, remote
  `merge-gate` status (plus dependent job statuses), review findings addressed
  with dispositions, commits added.
- **Polish:** bench results (ousterhout/carmack/grug/beck as applicable),
  architecture changes, test gaps filled, docs touched, confidence with evidence.
- **Refactor:** LOC delta, deletions, consolidations, modules simplified.
- **Land (if `/land`):** PR URL, merge SHA, branch deleted, local master
  fast-forwarded. Any residual risk flagged.
