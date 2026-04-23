---
name: yeet
description: |
  End-to-end "ship it to the remote" for linejam. Reads the whole worktree,
  classifies every path, deletes debris, splits in-flight work into
  semantically-meaningful Conventional Commits, and pushes through lefthook
  (gitleaks + eslint + prettier pre-commit, `pnpm ci:prepush` pre-push).
  Not a git wrapper — a judgment layer on top of git that respects linejam's
  load-bearing gate: the Dagger pipeline.
  Use when: "yeet", "yeet this", "commit and push", "ship it", "tidy and
  commit", "wrap this up and push", "get this off my machine".
  Trigger: /yeet, /ship-local (alias).
argument-hint: '[--dry-run] [--single-commit] [--no-push]'
---

# /yeet (linejam)

Take the current worktree state → one or more Conventional Commits → remote,
through linejam's full quality gate. One command. Executive authority. No
approval gates.

## Stance

1. **Act, do not propose.** Within `/yeet`'s domain — stage, classify, delete
   debris, split logically, push — the skill has authority. Escalate only on
   red-flag state (Refuse Conditions).
2. **Clean tree is the deliverable.** `/yeet` is not done while
   `git status --short` shows modified, staged, or untracked paths. Resolve
   every path by commit, ignore, move out of the repo, or delete.
3. **Reviewability is the product.** Three focused commits beat one 2,000-line
   "wip", every time. Split on semantic boundaries even inside one session.
4. **Never lose work.** Untracked scratch that might be the user's in-flight
   thinking gets moved, not deleted, unless it's unambiguous debris.
5. **Conventional Commits, always.** Linejam enforces this at commit-msg via
   commitlint (`@commitlint/config-conventional`). Non-compliant messages are
   rejected at the hook — match the format exactly.
6. **The Dagger gate is authoritative.** `pnpm ci:prepush` (= `pnpm
ci:dagger:all`) runs on pre-push. Red Dagger = push aborted, no bypass.

## Modes

- Default: stage → split into commits → push (lefthook runs pre-commit +
  commit-msg + pre-push).
- `--dry-run`: report the plan (commit boundaries, messages, skips), do not
  execute.
- `--single-commit`: skip the split pass; one commit for everything signal-class.
- `--no-push`: commit locally, skip `git push`. Use when the user wants to
  amend or stack more work before the Dagger gate runs.

## Linejam context (anchors you must cite, not reinvent)

- **Base branch: `master`.** Never force-push `master`. Feature branches
  freely rebase-squash.
- **Conventional Commits via commitlint.** Allowed types: `feat`, `fix`,
  `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `revert`. Scope
  optional. Subject imperative, ≤72 chars, no trailing period. `subject-case`
  is disabled — match the log's casing (lowercase dominates).
- **Pre-commit (auto):** parallel gitleaks + `pnpm eslint --fix` +
  `pnpm prettier --write` with `stage_fixed: true`. Reformatted bytes land in
  the same commit — expected, not a bug.
- **Pre-push:** `pnpm ci:prepush` → Dagger pipeline (lint, format-check,
  typecheck, audit, build-check, unit-test ≥85% coverage, secret-scan,
  Playwright E2E incl. authenticated). Red = abort; never `--no-verify`.
- **Invariant #1 (repo-brief): Never push on red Dagger.** If Dagger is wrong,
  fix the gate or the code — not the hook.
- **Backlog source-of-truth is `backlog.d/`, not GitHub Issues.** `/yeet`
  does NOT create backlog items (that's `/groom`). `/yeet` DOES delete debris
  and stale scratch.
- **`merge-gate` GitHub Actions mirrors Dagger remotely** for branch
  protection. Don't fight remote CI by evading local CI.

## Process

### 1. Read the worktree holistically

Run these (no shortcuts, no truncation):

- `git status --short --untracked-files=all`
- `git diff --stat` and `git diff --stat --cached`
- `git log -20 --oneline` (commit-style calibration on this repo)
- `git rev-parse --abbrev-ref HEAD` (push target)
- Check for in-progress ops: `.git/MERGE_HEAD`, `.git/CHERRY_PICK_HEAD`,
  `.git/rebase-merge/`, `.git/rebase-apply/`.

If the tree is clean, say so and exit.

### 2. Classify every file

| Class           | Meaning                                                                                               | Action                                                                                                           |
| --------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **signal**      | Work the user meant to do                                                                             | Include in a commit                                                                                              |
| **debris**      | Unambiguous trash: `.DS_Store`, `*.swp`, `*~`, `.#*`, stray `*.log`, `.orig`, `node_modules` escapees | Delete outright                                                                                                  |
| **drift**       | Unrelated work from another concern / earlier session                                                 | Separate commit, move out of repo, or add a durable ignore — never leave unresolved                              |
| **evidence**    | Playwright traces, screenshots, `tests/e2e/evidence/*` artifacts                                      | Include if the branch convention already tracks them; otherwise follow the repo's evidence dir pattern or delete |
| **scratch**     | `.groom/_scratch/`, `thinktank_*/`, half-written planning notes, `tmp/` docs                          | Delete if unambiguous session ephemera; move to `~/vault/linejam/` if potentially load-bearing                   |
| **secret-risk** | Plausible credentials / tokens / `.env`-like content                                                  | REFUSE the commit, surface to user                                                                               |

**Linejam-specific heuristics:**

- `.groom/_scratch/`, `thinktank_*/`, `.thinktank/` dirs → scratch. Delete on
  sight unless the user said otherwise this session.
- `.env*` not in `.gitignore` → secret-risk. Linejam has many env vars
  (`GUEST_TOKEN_SECRET`, `OPENROUTER_API_KEY`, Clerk keys, Canary keys);
  refuse if any land in staged files.
- `convex/_generated/**` — always ignored by lint/format globs. If these
  files change, they're signal (regenerated by Convex), but they should
  ride with the schema change, not stand alone.
- Playwright artifacts (`playwright-report/`, `test-results/`,
  `tests/e2e/evidence/*.png`) — evidence. Keep in `.gitignore`, don't commit
  unless the branch is explicitly evidence-tracking.
- Grep staged diff for secret patterns: `-----BEGIN.*PRIVATE KEY-----`,
  `(sk-|ghp_|github_pat_|AKIA)[A-Za-z0-9]{16,}`, `api[_-]?key.*=.*["'][^"']{20,}`,
  `CLERK_SECRET_KEY=.+`, `OPENROUTER_API_KEY=.+`. Match → refuse. (Gitleaks
  will also catch these at pre-commit, but `/yeet` catches them before the
  attempt.)
- If diff touches `lefthook.yml`, `dagger/src/index.ts`, `scripts/ci/*`,
  `.github/workflows/*` — that's CI infrastructure, its own commit scoped
  `ci:` or `build:`.

### 3. Group signals into semantic commits

**General rules:**

- **One concern per commit.** If a reviewer can't read the commit in isolation
  and judge it, split.
- **Co-changed tests ride with their code.** Feature + its Vitest/Playwright
  tests = one commit.
- **Config that enables the feature ships with the feature.** New env var in
  `lib/env.ts` that a new lane reads → same commit as the lane.
- **Refactors before features.** Pure refactor + feature that builds on it →
  commit the refactor first. Bisect stays sane.
- **Carmack's stapled-PR rule.** If you'd describe it as "X and also Y," split.

**Linejam-specific slicing heuristics:**

- **`convex/schema.ts` touch** → its own commit. Schema changes are load-bearing
  (indexes, validators). Often paired with a short ADR draft in `docs/adr/`
  in the same commit. Co-located `convex/_generated/*` regeneration ships
  here too.
- **`convex/lib/assignmentMatrix.ts` touch** → its own commit. This is
  game-correctness code (derangement invariant). Isolated diff = bisectable.
- **`lib/themes/presets/*.ts` (token changes) vs. theme consumers** → two
  commits. One `refactor(themes):` or `feat(themes):` for the preset tokens;
  one `style:` or `feat:` for the components that consume them.
- **Dagger / CI changes** (`dagger/src/index.ts`, `scripts/ci/*`,
  `lefthook.yml`, `.github/workflows/*`, `package.json` `ci:dagger:*` scripts)
  → always a dedicated commit, scope `ci:` or `build:`.
- **Dependency bumps** (`package.json` + `pnpm-lock.yaml` only) → `fix(deps):`
  for security/advisory patches, `chore(deps):` for routine bumps. Match
  the log — recent examples: `fix(deps): patch clerk and protobufjs HIGH/CRITICAL advisories`,
  `chore(deps): pin picomatch 2.3.2 via pnpm override`.
- **Convex queries/mutations + frontend call sites** can ship together if they
  implement one feature; do not split the contract from its sole caller.
- **`backlog.d/NNN-*.md`** — new backlog items belong in a `docs:` commit
  (or co-located with the work they track). `/yeet` does NOT author new
  backlog items.
- **PostHog event additions** (`lib/posthog/`) can ride with the feature that
  emits them. Isolated `lib/analytics.ts` (Vercel) changes are suspicious —
  new events should migrate to PostHog per the phase-out plan.

### 4. Write commit messages

Format (enforced by commitlint):

```
<type>(<scope>): <imperative subject ≤72 chars, no trailing period>

<optional body: why, not what. Wrap at 72.>

<optional footer: BREAKING CHANGE, Refs, Co-Authored-By>
```

**Allowed types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`,
`chore`, `revert`. (Note: unlike the spellbook source, linejam's commitlint
config does NOT list `build` or `ci` in `type-enum`. Use `chore` for CI /
build changes, or `fix(ci): …` / `fix(deps): …` when the change is
remediating a broken lane — both match recent log precedent.)

**Scope:** match the last 20 commits. Examples from current log:
`fix(deps):`, `fix(release):`, `fix(ci):`, `style:`, `chore(release):`,
`feat:`, `fix:`. Many commits omit scope entirely — omission is valid.

**Subject rules:**

- Imperative mood ("add", not "added" / "adds").
- No trailing period. Lowercase dominates (commitlint allows any case).
- Don't reference PR or issue numbers unless semantic-release is also
  running (look for `(#NNN)` suffix — the log shows both styles).

**Body rules:**

- Omit when the subject stands alone.
- When present, explain _why_ — the constraint, the incident, the
  alternative considered. Do NOT restate the diff.

**Co-author:** Match the session's actual contribution style. For agent
commits authored in a Claude Code session, use the project's established
footer pattern. When unsure, check `git log --format=%B -20 | grep -i co-auth`
and match.

**HEREDOC is mandatory** for any multi-line message to preserve formatting:

```bash
git commit -m "$(cat <<'EOF'
fix(deps): patch X and Y HIGH/CRITICAL advisories

<body if needed>
EOF
)"
```

### 5. Stage, commit, push

- `git add <explicit paths>` per commit. Never `git add -A` or `git add .`
  at repo root without full prior classification.
- `git commit` per group. Pre-commit runs automatically (gitleaks + eslint
  - prettier). If a hook rewrites files via `stage_fixed: true`, those bytes
    are already in the commit — expected.
- **If pre-commit fails** (gitleaks hit, eslint error it can't auto-fix):
  diagnose and fix. Never `--no-verify`. If it's a gitleaks false positive,
  update `.gitleaks.toml` allowlist in the same commit (or a prior one if
  cleaner).
- After final commit: `git log --oneline origin/master..HEAD` and sanity-check
  the shape before pushing.
- `git push`. Upstream not set → `git push -u origin <branch>`. Pre-push runs
  `pnpm ci:prepush` → Dagger.
- **If Dagger fails:** abort the push. Diagnose the failing lane (the hook
  output names it). Repo-brief says explicitly: "Git push is failing.
  Investigate and fix." — don't propose local workarounds; fix the red lane.
  Common: Clerk smoke-account drift, Convex dev deployment out-of-sync,
  coverage under 85%, prettier drift.
- **If push is rejected** (upstream moved on feature branch): `git pull
--rebase` and retry once. Still rejected → stop, investigate. Never force-
  push `master`. Force-push on feature branches is acceptable only when you
  rebased cleanly.
- After push: rerun `git status --short --untracked-files=all`. Any visible
  path → classify and resolve. `/yeet` exits only on a clean tree.

### 6. Report

- Commit shape: one line per commit (sha, type, subject).
- What got removed, ignored, or moved — and why.
- Push target + result (lane outputs if Dagger spoke).
- Final worktree status (`clean`, or the refuse reason).

## Before-push checklist

Execute in order before the first commit. Catches the common failure modes
cheaply, before lefthook runs and retries cost minutes.

1. **Read every hunk.** `git status --short`, `git diff`, `git diff --cached`.
   No truncation. If a hunk looks wrong, stop and classify.
2. **Debris scan.** `.groom/_scratch/`, `thinktank_*/`, `test-results/`,
   `playwright-report/`, stray `*.log`, large unstaged binaries, files
   outside `node_modules` that look like dependency escapees. Delete or
   ignore.
3. **Plan the commit graph.** 3–5 semantically meaningful commits is the
   typical target for a multi-concern session. One commit for a single
   focused change.
4. **Cheap pre-flight to save pre-commit/pre-push time:**
   - `pnpm typecheck` (app + Dagger) — catches TS drift before prettier
     rewrites bytes you'll have to re-stage.
   - `pnpm lint:fix` — applies the same autofixes lefthook would, but across
     the whole repo instead of only staged files (useful when you just
     rewrote many files).
5. **Commit one-by-one.** Stage only that commit's paths. Use HEREDOC for
   Conventional Commit messages. Let pre-commit run.
6. **Sanity-check the shape.** `git log --oneline origin/master..HEAD` —
   read the stack as a reviewer would. Reorder or squash if it reads wrong.
7. **Push.** Lefthook pre-push runs Dagger. Red = abort, diagnose, fix the
   lane. Never `--no-verify`.

## Refuse Conditions

Stop and surface to the user instead of committing:

- `.git/MERGE_HEAD`, `.git/CHERRY_PICK_HEAD`, or `rebase-*` dir exists —
  mid-operation; `/yeet` is not a recovery tool.
- Diff contains unresolved conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`).
- Any file classified `secret-risk`.
- HEAD is detached.
- Current branch is `master` AND push would write there (absent an explicit
  user request tied to a release flow like semantic-release).
- Worktree has >500 files changed AND no obvious semantic grouping — ask
  the user whether something unexpected happened (merge artifact, stale
  generated code, wrong branch).
- Dagger is known red on a prior run AND no fix has landed — pushing will
  just block on pre-push.

## Safety rails (never)

- **Never `--no-verify`.** Not for pre-commit, not for commit-msg, not for
  pre-push. Linejam's Invariant #1. If the gate is wrong, fix the gate.
- **Never force-push `master`.** Feature branches can force-push (rebased
  squash history is fine).
- **Never `git add -A`** at repo root without classifying first — risk of
  sweeping up scratch, evidence, or secrets.
- **Never `git clean -fdx`** or delete directories wholesale without
  individual-file classification.
- **Never commit Convex production code** without `LINEJAM_ALLOW_PROD_CONVEX_SYNC=1`
  (repo-brief Invariant #3). Dagger refuses by default; don't engineer around it.
- **Never commit placeholder Canary keys.** `NEXT_PUBLIC_CANARY_*` must be
  real values in build-bearing lanes (Invariant #4). Placeholder = secret-risk
  equivalent for the purpose of refusing.
- **Never declare success while `git status --short` shows paths.**
- **Never create backlog items inside `/yeet`.** That's `/groom`'s job.

## Gotchas

- **"Tidy" is not refactor.** `/yeet` stages and commits. It does not edit
  source to make the diff prettier. Messy diff → `/refactor` concern.
- **Match the log, not a template.** Linejam's log mixes scoped and unscoped
  commits; many recent fixes use `fix(deps):` or `fix(ci):` without broader
  scopes. Don't invent a scope taxonomy.
- **`[codex] …` prefix appears in the log.** Those were Codex-authored PRs;
  don't mimic the prefix unless authoring from Codex.
- **`chore(release): X.Y.Z [skip ci]` is semantic-release output.** Don't
  hand-author those. If you see one in your own diff, something went wrong.
- **Untracked dirs need explicit recursion.** `git status` shows them but
  `git add` doesn't recurse unless you pass the dir. Classify each new dir
  directory-by-directory.
- **Pre-commit reformats are expected.** `stage_fixed: true` means prettier
  and eslint rewrites land in the same commit. Don't panic, don't re-stage.
- **Dagger lane failures name themselves.** The hook output specifies which
  lane (`ci:dagger:lint`, `ci:dagger:e2e`, etc.). Run that single lane
  locally to iterate, not the whole pipeline.
- **Playwright flake is usually environmental.** Clerk smoke-account drift
  or Convex dev deployment out-of-sync is more likely than a real regression
  (repo-brief gotcha #8). Don't patch the test before verifying the
  environment.
- **`useQuery` has no error state in Convex 1.x.** If your diff adds a
  `useQuery` call, make sure there's an ErrorBoundary or
  `data === undefined && !isLoading` pattern upstream. Not a `/yeet`
  responsibility to add, but a red flag that the commit may not be
  complete.
- **Push rejection on first try is usually benign:** upstream moved.
  `git pull --rebase` + push once. Second rejection → stop.

## Output

On success:

```markdown
## /yeet Report

Branch: fix/patch-clerk-protobufjs-advisories → origin/fix/patch-clerk-protobufjs-advisories

Classified 14 paths: 11 signal, 2 debris, 1 scratch.
Deleted: .groom/\_scratch/shape-notes.md, test-results/.last-run.json
Moved out of repo: notes/convex-schema-draft.md → ~/vault/linejam/notes/

Commits:
abc1234 fix(deps): patch X and Y HIGH/CRITICAL advisories
def5678 test: cover guest-token parity across surfaces
9012345 docs: record ADR-0009 for hybrid guest+clerk JWT

Pushed via lefthook pre-push.
Dagger lanes (pnpm ci:prepush): all green (5m 12s).
Worktree: clean.
```

On refuse:

```markdown
## /yeet — REFUSED

Reason: staged diff contains plausible secret at
convex/lib/ai/providers/openrouter.ts:42 (matches /sk-or-v1-[A-Za-z0-9]{32}/).
Action: remove or scrub before re-running. Gitleaks would also catch this at
pre-commit, but surfacing early saves a failed commit round-trip.
```

```markdown
## /yeet — REFUSED

Reason: `pnpm ci:prepush` failed on `ci:dagger:unit-test` — coverage 83.4%
(threshold 85%). Lane output: 3 uncovered branches in convex/game.ts.
Action: add tests covering the missed branches, or justify threshold
adjustment in a separate PR. Never `--no-verify`.
```
