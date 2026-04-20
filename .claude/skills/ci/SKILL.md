---
name: ci
description: |
  Drive linejam's Dagger pipeline green. The load-bearing gate is
  `pnpm ci:prepush` (= `pnpm ci:dagger:all`) — lint, format-check, typecheck
  (app + Dagger), secret-scan, osv-scanner audit, unit-test with 85% coverage
  floor, build-check, and Playwright E2E. Lefthook pre-push enforces it;
  `--no-verify` is forbidden. Acts on diagnosis, never reports red without
  structured self-heal. GitHub Actions mirrors the contract; local Dagger
  is authoritative.
  Use when: "git push is failing", "ci is red", "dagger lane failed",
  "run ci", "run the gates", "run prepush", "check ci", "fix ci",
  "audit ci", "why is the build red", "e2e flake", "coverage dropped",
  "gitleaks caught something", "osv-scanner is failing".
  Trigger: /ci, /gates.
argument-hint: '[--audit-only|--run-only|--lane=<name>]'
---

# /ci — linejam's Dagger gate

**The load-bearing gate is `pnpm ci:prepush`.** It shells to
`pnpm ci:dagger:all`, which runs the TypeScript Dagger module defined in
`dagger/src/index.ts` (~600 LOC). That module is the authoritative
pipeline. GitHub Actions (`.github/workflows/ci.yml`) mirrors it via
`./scripts/ci/dagger-call.sh <function>`; hosted CI is secondary
confirmation, not the source of truth.

This skill drives the full `Ci.all` function green. It owns lint, format,
typecheck (app + Dagger), secret-scan, osv-scanner audit, unit-test
(85% coverage floor), build-check, and Playwright E2E.

Stops at green. Does not review code semantics (use `critic`), does not
ship (the release workflow runs automatically on `master`).

## Repo-specific invariants

Pulled verbatim from `.claude/repo-brief.md`. Crossing any of these
is a red line, not a suggestion.

1. **Never push on red Dagger.** Lefthook pre-push (`lefthook.yml:30-34`)
   runs `pnpm ci:prepush` unconditionally. `git push --no-verify` is
   forbidden. If the hook is wrong, fix the hook or the gate — don't
   evade it.
2. **Never run `convex dev` or `pnpm dev` yourself.** The user keeps both
   running in a separate terminal. Spawning duplicates kills schema
   sync and corrupts the guest-token flow. Ask, don't spawn.
3. **Never push prod Convex without `LINEJAM_ALLOW_PROD_CONVEX_SYNC=1`.**
   `scripts/ci/dagger-call.sh:378-386` refuses by default. The flag is
   an intentional speed bump, not a nuisance to work around.
4. **Never push placeholder Canary keys.** `ensure_canary_browser_config`
   in `scripts/ci/dagger-call.sh:453-469` fails fast if
   `NEXT_PUBLIC_CANARY_API_KEY=example_canary_write_key` or either
   Canary var is empty. Build-bearing lanes (all, all-no-e2e,
   build-check, e2e) require real values.
5. **Never lower a threshold to pass a gate.** `vitest.config.ts:40-45`
   pins coverage at 85% (lines, branches, functions, statements).
   Raising it is fine; lowering it is forbidden.
6. **Session signal: "Git push is failing" means diagnose the Dagger
   lane, not propose local workarounds.** The user does not want
   `pnpm vitest` or raw `next build` — they want the Dagger lane
   fixed or a precise escalation.

## The Dagger lanes

Each lane is a `@func()` in `dagger/src/index.ts`. Invoke via
`pnpm ci:dagger:<name>` (which shells to `./scripts/ci/dagger-call.sh`).
Individual lanes are the right tool when isolating a failure; `all` is
the authoritative gate.

| Lane           | Script                                   | What it runs                                                                                                                                           | Primary failure symptom                                                       | Likely root cause                                                                                                                                                                                                      |
| -------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `format-check` | `pnpm ci:dagger:format-check`            | `pnpm format:check` (prettier) in `node:22-bookworm`                                                                                                   | "Code style issues found in N files"                                          | Someone committed without lefthook (hook skipped, wrong machine). Fix: `pnpm format`.                                                                                                                                  |
| `lint`         | `pnpm ci:dagger:lint`                    | `pnpm lint` (eslint 9)                                                                                                                                 | ESLint rule violation                                                         | New code violates a rule; `eslint --fix` handles many. Never silence with `// eslint-disable` in prod code.                                                                                                            |
| `typecheck`    | `pnpm ci:dagger:typecheck`               | `tsc --noEmit` on app + `dagger/tsconfig.json`                                                                                                         | TS error in `app/`, `components/`, `convex/`, `lib/`, or `dagger/src/`        | Often `convex/_generated/api.d.ts` drift — ask user to run `pnpm dev:convex` locally to regenerate. Never cast to `any` to shut it up.                                                                                 |
| `secret-scan`  | `pnpm ci:dagger:secret-scan`             | `gitleaks dir . --config .gitleaks.toml --redact`                                                                                                      | "leaks found: N"                                                              | Real secret (escalate immediately — do not rewrite history), or a false positive that needs `.gitleaks.toml` allowlist entry.                                                                                          |
| `audit`        | `pnpm ci:dagger:audit`                   | `osv-scanner scan --lockfile=pnpm-lock.yaml`, fails on HIGH/CRITICAL only                                                                              | "Found HIGH or CRITICAL advisories — failing build."                          | Replaces legacy `pnpm audit --audit-level=high` (pnpm's audit endpoint returns HTTP 410). Fix via `pnpm update <pkg>` or add a `pnpm.overrides` entry in `package.json` (see existing overrides for clerk/protobufjs). |
| `unit-test`    | `pnpm ci:dagger:unit-test`               | `pnpm test:ci` = `vitest run --coverage`                                                                                                               | Failing test OR coverage below 85%                                            | If test fails: escalate — never `it.skip`. If coverage dropped: write tests for the uncovered lines. `vitest.config.ts` enforces `maxWorkers: 1` on threads pool to avoid Node 22 teardown hang; don't change it.      |
| `build-check`  | `pnpm ci:dagger:build-check`             | `pnpm build:check` = `next build`. Requires real `GUEST_TOKEN_SECRET` + Canary vars                                                                    | "GUEST_TOKEN_SECRET is required for build-check" or Canary validation failure | Env hydration gap. See "GUEST_TOKEN_SECRET hydration" below.                                                                                                                                                           |
| `e2e`          | `pnpm ci:dagger:e2e`                     | Builds then `pnpm test:e2e` in `mcr.microsoft.com/playwright:v1.58.2-noble`. Requires `GUEST_TOKEN_SECRET`; `PLAYWRIGHT_REQUIRE_AUTH_E2E=1` by default | Playwright test timeout, Clerk sign-in failure, Convex query hanging          | **Gotcha #8: Clerk smoke-account drift or Convex dev deployment out-of-sync first.** Investigate both before blaming the test.                                                                                         |
| `smoke`        | `pnpm ci:dagger:smoke`                   | `pnpm test:e2e:smoke` against `PLAYWRIGHT_BASE_URL` (preview or prod)                                                                                  | Auth-required smoke failing against Clerk live instance                       | Live Clerk keys fail closed in the smoke lane — ensure `PLAYWRIGHT_CLERK_TEST_EMAIL` points at a precreated smoke account.                                                                                             |
| `all-no-e2e`   | `pnpm ci:dagger:all-no-e2e`              | Sequence: format-check → lint → typecheck → secret-scan → audit → unit-test → build-check. ~90s cold                                                   | First failing lane in the sequence                                            | Use this when iterating on non-E2E changes; full `all` is ~5min.                                                                                                                                                       |
| `all`          | `pnpm ci:dagger:all` / `pnpm ci:prepush` | `all-no-e2e` then `e2e`                                                                                                                                | Anything above                                                                | **This is the gate.** If this fails, push is blocked.                                                                                                                                                                  |

## How env is hydrated

`scripts/ci/dagger-call.sh` is a ~600-line shim that handles everything
the Dagger container needs before shelling to `dagger call`. The
important logic:

- **Env loading order:** `.env` → `.env.production.local` → `.env.local`
  (last wins). Smoke reverses: `.env.local` loads first so localhost-safe
  Clerk keys can override production values for dev smoke runs.
- **Convex sync (`all`, `e2e` only):** Unless `LINEJAM_SYNC_CONVEX_BEFORE_DAGGER=0`,
  local Dagger runs `convex dev --once --typecheck disable` to sync the
  active dev deployment before E2E. If `NEXT_PUBLIC_CONVEX_URL` points at
  prod, this refuses to sync unless `LINEJAM_ALLOW_PROD_CONVEX_SYNC=1`.
- **Clerk `convex` JWT template (`all`, `e2e` only):** Runs
  `scripts/ci/ensure-clerk-convex-template.mjs` to verify / create the
  template in the active Clerk instance. Keep
  `LINEJAM_ALLOW_LIVE_CLERK_TEMPLATE_CREATE=0` unless intentionally
  provisioning against a live Clerk.
- **GUEST_TOKEN_SECRET hydration (`all`, `all-no-e2e`, `build-check`, `e2e`):**
  If unset, hydrates from `convex env get GUEST_TOKEN_SECRET` (matching
  the active dev/prod Convex deployment). Invariant #8 from the brief:
  **secret must match across Vercel + Convex + local `.env.local`.**
  Silent mismatch drops guest joins.
- **Canary browser config (`all`, `all-no-e2e`, `build-check`, `e2e`):**
  Refuses placeholder `example_canary_write_key`. Fails if endpoint or
  API key empty.
- **Source snapshot:** Every run creates a tempdir via
  `git ls-files --cached --others --exclude-standard` + rsync so Dagger
  sees only tracked + untracked-but-unignored files (no node_modules,
  no .next, no build artifacts).
- **Transport-cleanup false-failure handling:** If Dagger reports
  `Post "http://dagger/query": unexpected EOF` AFTER the `<LaneName> DONE`
  marker is logged, the script treats the run as passed. This is a known
  Dagger session-cleanup race, not a real failure.

## Modes

- **Default:** audit → run. Full pass.
- `--audit-only`: produce gap report against the rubric; do not run lanes.
- `--run-only`: skip audit, drive `pnpm ci:prepush` green.
- `--lane=<name>`: run one Dagger lane (`lint`, `typecheck`, etc.) for
  focused iteration. Still ends with a full `pnpm ci:prepush` verification.

## Process

### Phase 1 — Audit (skip if `--run-only`)

linejam's pipeline is already mature — most audits find zero gaps. The
audit exists to catch regressions (a lane disabled, a threshold lowered,
a new script bypassing Dagger). The checks, in order of blast radius:

1. **`dagger/src/index.ts` present and lanes enumerated.** Every entry
   in the Dagger Lanes table above must exist as a `@func()`. Missing =
   HIGH, block until restored.
2. **`lefthook.yml` pre-push runs `pnpm ci:prepush`.** If the hook was
   watered down (changed to `all-no-e2e`, or anything else), restore it.
3. **`vitest.config.ts` coverage thresholds still 85% / 85% / 85% / 85%.**
   Lower = HIGH, revert immediately. This is a load-bearing wall.
4. **`.github/workflows/ci.yml` thinness.** Every step under
   `quality-gates`, `test-build`, and `e2e` must be
   `./scripts/ci/dagger-call.sh <name>`. Inline `pnpm lint` / `pnpm test`
   in a GHA step = finding (pipeline lives in two places, drifts).
   The `qa-evidence` job is the exception — it runs `pnpm build:check`
   - `pnpm evidence:guest-flow` directly for artifact capture only, and
     is explicitly not a required check.
5. **`lefthook.yml` pre-commit parallel: gitleaks, eslint --fix, prettier
   --write with `stage_fixed: true`.** If any is missing, restore. Don't
   add new pre-commit gates — they belong in pre-push Dagger.
6. **`package.json` `ci:dagger:*` scripts all shell to
   `./scripts/ci/dagger-call.sh <name>`.** No inline bash.
7. **Placeholder Canary keys.** Grep for `example_canary_write_key` in
   committed env templates. The authoritative contract fails on these;
   don't re-introduce them as "defaults".
8. **`osv-scanner` gate filters to HIGH/CRITICAL.** That matches prior
   `pnpm audit --audit-level=high` semantics. Anything tighter (blocking
   MODERATE) would need a deliberate escalation; anything looser is a
   regression.
9. **`merge-gate` job in `ci.yml` depends on all required jobs.**
   Branch protection requires the job name `merge-gate` exactly.
   Renaming silently breaks merge blocking.

Emit the findings table. For each gap, apply the mechanical fix
directly — do not emit "proposals" awaiting approval. Escalate only
when the fix would disable a currently-green lane, materially change
scope, or encode a product decision the code alone can't resolve.

### Phase 2 — Run (skip if `--audit-only`)

1. Run `pnpm ci:prepush`. Capture per-lane output. Expect ~5 minutes
   cold, faster warm (pnpm store + Playwright browser caches are
   Dagger cache volumes: `linejam-pnpm`, `linejam-pnpm-playwright`).
2. If green → emit report, exit 0.
3. If red → identify which lane failed (first line of the
   `runChecks` output sequence is the failing lane). Re-run that lane
   in isolation via `pnpm ci:dagger:<lane>` to get clean logs.
4. Classify per the self-heal table below. Self-heal inline, or escalate
   with a structured diagnosis.
5. Bounded retries: **3 attempts per lane.** If not converging, escalate.

### Phase 3 — Verify

Final `pnpm ci:prepush` after any fixes. Green or bust. If Phase 1
strengthened anything, the full pipeline must pass under the new state
before the skill returns clean.

## Self-heal playbook (linejam-specific)

| Failure                                                           | Classification                       | Action                                                                                                                                                                                                                                                                                                  |
| ----------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prettier diff in lint/format-check                                | Mechanical drift                     | `pnpm format`, commit as `style: prettier-format`, re-run lane.                                                                                                                                                                                                                                         |
| ESLint auto-fixable                                               | Mechanical drift                     | `pnpm lint:fix`, commit as `style: eslint --fix`, re-run.                                                                                                                                                                                                                                               |
| Vitest test asserts behavior that changed                         | Logic failure                        | Escalate. Never modify the assertion. Never `it.skip`.                                                                                                                                                                                                                                                  |
| Coverage below 85%                                                | Authoring task                       | Escalate with pointer to under-covered files from `coverage/lcov.info`. Do NOT lower the threshold — Invariant #5.                                                                                                                                                                                      |
| `convex/_generated/api.d.ts` TS errors                            | Likely generated drift               | Ask user to run `pnpm dev:convex` in their terminal (per Invariant #2, don't spawn it yourself). Re-run typecheck.                                                                                                                                                                                      |
| TS error in hand-written code                                     | Contract signal                      | Fix with explicit type narrowing if obvious (null guard the linter didn't infer). Escalate if it requires a contract change. Never cast to `any`.                                                                                                                                                       |
| osv-scanner HIGH/CRITICAL advisory                                | Dep fix needed                       | Try `pnpm update <pkg>` first. If fix is only on a transitive, add to `pnpm.overrides` in `package.json` (see existing clerk/protobufjs/undici overrides). Run `pnpm install`, commit lockfile + manifest, re-run audit.                                                                                |
| gitleaks real secret                                              | Security                             | **Escalate immediately.** Do not rewrite history — the secret is already committed. Rotate the credential, then expand the allowlist with a justification if the match was unavoidable.                                                                                                                 |
| gitleaks false positive                                           | Config update                        | Add entry to `.gitleaks.toml` allowlist with comment explaining why it's safe. Re-run scan.                                                                                                                                                                                                             |
| Playwright flake, auth test fails in `e2e` lane                   | **Gotcha #8**                        | In order: (1) confirm Clerk smoke account `PLAYWRIGHT_CLERK_TEST_EMAIL` still exists and can sign in; (2) verify Convex dev deployment is synced (`pnpm ci:dagger:e2e` will auto-sync unless `LINEJAM_SYNC_CONVEX_BEFORE_DAGGER=0`). Only after both pass, retry the test once. If still red, escalate. |
| `Dagger transport cleanup failed after X completed successfully`  | Known Dagger session race            | `dagger-call.sh` already treats this as passed. If it escapes that logic, re-run the lane once. Do not fix by retrying unrelated lanes.                                                                                                                                                                 |
| `GUEST_TOKEN_SECRET is required for build-check`                  | Env hydration gap                    | Usually means `NEXT_PUBLIC_CONVEX_URL` points at a backend the Convex CLI can't resolve (prod without `--prod` access, or a stale deployment). Run `convex dev --once` manually, or unset `NEXT_PUBLIC_CONVEX_URL` to let the shim hydrate from the active dev deployment.                              |
| `Refusing to run … with placeholder NEXT_PUBLIC_CANARY_API_KEY`   | Invariant #4                         | Export real Canary browser write key from password manager. Do not commit placeholders.                                                                                                                                                                                                                 |
| `Refusing to sync the Convex production deployment`               | Invariant #3                         | Verify you actually want prod sync. If yes, export `LINEJAM_ALLOW_PROD_CONVEX_SYNC=1` for the single run. Never permanently set this.                                                                                                                                                                   |
| Lockfile drift (`pnpm-lock.yaml` out of sync with `package.json`) | Mechanical                           | `pnpm install --frozen-lockfile` (to reproduce), then `pnpm install` (to resolve), commit the updated lockfile, re-run. If resolve fails (genuine dep conflict), escalate.                                                                                                                              |
| E2E test passes on retry                                          | Classify as flake only on second run | One retry. If green, note in report. If still red, treat as real failure. Never mask.                                                                                                                                                                                                                   |

## Delegation

Dispatch focused fixes to `builder` for any self-heal that involves
production code changes (e.g. fixing a narrow TS error, updating a dep
override, writing missing tests). Keep lead context clean.

For diagnosis that requires reading 3+ files to understand a failure
(e.g. "why did this Convex mutation break"), dispatch an `Explore`
subagent — read-only, return a one-screen diagnosis, not a fix.

If the self-heal would change Dagger pipeline architecture (adding a new
lane, restructuring `runChecks`), that is a design decision — hand off
to `planner` first.

Available agents in spellbook: `planner`, `builder`, `critic`, `carmack`,
`ousterhout`, `grug`, `beck`, `a11y-auditor`, `a11y-critic`, `a11y-fixer`.
Do not invent names.

## What /ci does NOT do

- Review code semantics → `critic` agent.
- Address PR review comments → out of scope.
- Deploy or release → Release workflow runs on `master` push automatically
  (`semantic-release` via `.github/workflows/release.yml`).
- QA against a running app → `qa-evidence` job captures artifacts; this
  skill does not drive manual QA.
- Run `pnpm dev` or `convex dev` — see Invariant #2.
- Write a new Dagger lane from scratch — that is a design decision; file
  it as a backlog item under `backlog.d/NNN-*.md` with Goal + Oracle.

## Anti-patterns (linejam-specific)

- **Running `pnpm vitest` or `pnpm next build` directly when a Dagger
  lane fails.** This bypasses the hermetic-container contract. The only
  thing that proves `pnpm ci:prepush` will pass is running
  `pnpm ci:prepush` or the specific `pnpm ci:dagger:<lane>`.
- **Skipping `pnpm ci:prepush` with `git push --no-verify`.** Forbidden.
  Invariant #1.
- **Lowering the 85% coverage threshold in `vitest.config.ts`.** Invariant
  #5. Any such change is an escalation signal, not a fix.
- **Adding inline `pnpm lint` / `pnpm test` steps to
  `.github/workflows/ci.yml`.** The workflow is a thin shim over
  `./scripts/ci/dagger-call.sh`. Keep it that way; otherwise the
  pipeline lives in two places and drifts.
- **Running `convex dev` or `pnpm dev` to "reset the environment" when a
  lane fails.** Invariant #2. Ask the user — they already have both
  running.
- **Committing placeholder Canary keys (`example_canary_write_key`) to
  unblock a local run.** Invariant #4. The contract fails fast on these
  by design.
- **Treating Playwright flake as a flake without checking Clerk and
  Convex first.** Gotcha #8. These are the actual common causes; the
  test itself is usually correct.
- **Exporting `LINEJAM_ALLOW_PROD_CONVEX_SYNC=1` in your shell rc.**
  Invariant #3. Per-run only, and only when you genuinely intend prod
  sync.
- **Declaring green while Dagger is still running.** Wait for the exit
  code. The `<LaneName> DONE` marker in stdout is not the final word —
  only the process exit is.
- **Adding a new pre-commit hook instead of a Dagger lane.** Pre-commit
  is intentionally fast (gitleaks + eslint --fix + prettier --write).
  Anything heavier belongs in `pnpm ci:prepush`.
- **Reporting red and exiting when the failure was a trivially fixable
  prettier drift.** Self-heal first.

## Output

```markdown
## /ci Report

Audit: 0 gaps (pipeline healthy).
Run: pnpm ci:prepush — 10 lanes, 1 self-heal (prettier auto-format on
lib/themes/presets/kenya.ts), 0 escalations.
Final: green. Full pipeline 4m47s (cold cache: Dagger session first run
of the day).
```

On escalation:

```markdown
## /ci Report — RED

Lane: unit-test (pnpm ci:dagger:unit-test)
Failure:
tests/lib/assignmentMatrix.test.ts:142
AssertionError: matrix[2][0] expected 'alice', got 'bob'
Coverage: 86.3% (passes threshold)
Classification: logic failure — derangement algorithm no longer produces
the expected output for 4-player × 9-round configuration.
Candidate cause: recent change to `convex/lib/assignmentMatrix.ts`
swapped iteration order; test encodes the contract that no player
writes consecutive lines for the same poem.
Suggested next step: re-read the derangement spec in
`convex/lib/assignmentMatrix.ts` and decide whether the contract
changed (update test + doc) or the change regressed (revert/fix).
Retry count: 3/3. Escalating — human decision needed on algorithm
contract.
```
