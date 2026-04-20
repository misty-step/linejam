# AGENTS.md — Linejam Router

One-page map for AI agents. Not a manual. Read the linked files when you
need depth.

## Stack & Boundaries

| Layer          | Version                             | Owns                                                                                                                                                                              |
| -------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/`         | Next.js 16.2 (React 19, App Router) | Routes, API handlers, client-first components. Feature folders: `(auth)/`, `host/`, `join/`, `room/`, `poem/`, `me/`.                                                             |
| `components/`  | React 19                            | UI primitives (`Button`, `Card`, `Input`) + game screens (`Lobby`, `WritingScreen`, `RevealPhase`, `RoomChrome`) + `CanaryClientObserver.tsx`.                                    |
| `convex/`      | Convex 1.31                         | Backend schema (`schema.ts` — 10 tables), queries, mutations, actions, scheduler. All types auto-generated into `_generated/api.d.ts`.                                            |
| `convex/lib/`  | —                                   | Auth (`auth.ts`), assignment matrix (`assignmentMatrix.ts`), AI personas (`ai/personas.ts`), OpenRouter provider (`ai/providers/openrouter.ts`), structured errors (`errors.ts`). |
| `lib/`         | —                                   | Frontend domain: `auth.ts` (useUser), `logger.ts`, `error.ts` (captureError), `wordCount.ts`, `roomCode.ts`, `errorFeedback.ts`.                                                  |
| `lib/themes/`  | —                                   | Four presets (`kenya` default, `mono`, `vintage-paper`, `hyper`) + `ThemeProvider`.                                                                                               |
| `lib/posthog/` | PostHog                             | Canonical product analytics. `lib/analytics.ts` (Vercel Analytics) is phasing out.                                                                                                |
| `tests/`       | Vitest 4 + Playwright               | Unit/integration colocated or under `tests/`, E2E under `tests/e2e/`. 85% coverage floor.                                                                                         |
| `dagger/`      | Dagger TypeScript SDK               | CI pipeline (`src/index.ts`, ~800 LOC). The gate.                                                                                                                                 |
| `scripts/`     | Node ESM                            | CI bootstrap (`ci/bootstrap-convex-env.mjs`), Canary responder (`canary/responder.mjs`), evidence capture, claim lib (`lib/claims.sh`).                                           |
| `backlog.d/`   | Markdown                            | **Authoritative** backlog. Numbered `NNN-kebab.md` with Priority / Status / Estimate / Goal / Oracle. `_done/` archive.                                                           |
| `docs/adr/`    | Markdown                            | ADRs 0001–0008 filed. New architectural decisions file here via `000-template.md`.                                                                                                |

## Ground-Truth Pointers

Stale training data lies. Read these when you need the truth:

- `convex/_generated/api.d.ts` — Convex API surface. Regenerates on `convex dev` / `pnpm build`.
- `convex/schema.ts` — 10 tables, 14 `v.optional()` fields. Source of truth for data model.
- `convex/lib/assignmentMatrix.ts` — derangement-like algorithm for line assignment. Load-bearing for game correctness (ADR 0002, 0004).
- `lib/themes/presets/*.ts` — concrete theme tokens for each of the four themes.
- `dagger/src/index.ts` — gate behavior. Read this before debugging `pnpm ci:prepush`.
- `lefthook.yml` — commit-msg, pre-commit, and pre-push hooks.
- `.claude/repo-brief.md` — shared spine for all tailored skills.

## Invariants

Hard rules. Violating these breaks something load-bearing.

1. **Never push on red Dagger.** Pre-push hook enforces `pnpm ci:prepush`. **Never `--no-verify`**.
2. **Never run `pnpm dev` / `convex dev` / server processes yourself.** The user keeps them running. Ask.
3. **Never push Convex production without `LINEJAM_ALLOW_PROD_CONVEX_SYNC=1`.** Intentional speed bump.
4. **Never push placeholder Canary keys.** `NEXT_PUBLIC_CANARY_*` must be real in build-bearing lanes.
5. **Never mock `@/` or `../../` paths.** Mock at system boundaries only (Convex/react, @clerk/nextjs, fetch, localStorage, clipboard, Date, Math.random).
6. **Parallel DB writes via `Promise.all`.** Batch N+1 reads with `q.or()`. No sequential `await` in loops over `ctx.db.patch`.
7. **Every `while` loop needs a termination guard.** Infinite-loop test hangs are non-negotiable.
8. **`GUEST_TOKEN_SECRET` must match across Vercel + Convex + local.** Mismatch silently drops guest joins.
9. **Base branch is `master`. Conventional Commits only** (commitlint enforces).
10. **Backlog source-of-truth is `backlog.d/`, NOT GitHub Issues.** `gh issue list` should be empty.

## Gate Contract

**`pnpm ci:prepush`** is THE gate (= `pnpm ci:dagger:all`). Lefthook pre-push enforces.

Composition (each lane runnable as `pnpm ci:dagger:<lane>`):

- `lint` — ESLint (Next core-web-vitals config).
- `format-check` — Prettier.
- `typecheck` — app (`tsc --noEmit`) + Dagger TypeScript.
- `secret-scan` — gitleaks.
- `audit` — osv-scanner (replaced `pnpm audit` in commit `6a76039`).
- `build-check` — `next build` in a container.
- `unit-test` — Vitest with 85% coverage floor (lines/branches/functions/statements).
- `e2e` — Playwright; includes authenticated Clerk coverage by default.
- `smoke` — remote endpoint smoke via `playwright.smoke.config.ts`.

Pre-commit (parallel, Lefthook): gitleaks + `eslint --fix` + `prettier --write` (with `stage_fixed: true`).
Commit-msg: commitlint (type-enum: `feat, fix, docs, style, refactor, perf, test, chore, revert` — no `build`/`ci`).
Branch protection: `merge-gate` rollup check (depends on `quality-gates`, `test-build`, `e2e`).

GitHub Actions (`.github/workflows/ci.yml`) mirrors the Dagger contract remotely. Local Dagger is authoritative.

## Known-Debt Map

| Debt                                                                                              | Pointer                                                          | Tracker                                                                                           |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| CI redesign SHAPE-E (preview-first promotion gate)                                                | `docs/ci/redesign-2026Q2.md`                                     | `backlog.d/` slices 010–015                                                                       |
| N+1 author fetches in `getRevealPhaseState`                                                       | `convex/game.ts`                                                 | Covered by redesign slice work                                                                    |
| PostHog migration                                                                                 | `lib/analytics.ts` (6 Vercel events) → `lib/posthog/`            | On-touch migration when `lib/analytics.ts` is edited                                              |
| `useQuery` no error-state                                                                         | Convex 1.x library + all call sites                              | Mitigated via ErrorBoundary; Convex SDK limitation, not currently ticketed                        |
| `/api/health` vs Canary readiness conflation                                                      | `app/api/health/route.ts`, `components/CanaryClientObserver.tsx` | `/monitor` skill distinguishes the two                                                            |
| Prompt injection in OpenRouter provider                                                           | `convex/lib/ai/providers/openrouter.ts`                          | **Explicitly deprioritized** by user ("idc about prompt injection here really"). Do not re-raise. |
| Browser-agent bake-off (Playwright 1.59 / Stagehand v3 / browser-use / Vercel Labs agent-browser) | `backlog.d/007-establish-stagehand-agentic-qa-harness.md`        | Blocks `backlog.d/008-*`                                                                          |
| No `.glance.md`, no `docs/CODEBASE_MAP.md`                                                        | —                                                                | `/tune-repo` never run; non-blocking                                                              |

Cerberus is out (workflow deleted `5dc890c`). Do not resurrect.

## Harness Index

### Skills (`.claude/skills/`)

**Workflow — linejam-specific, rewritten:**

| Skill          | What it does here                                                                                                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/ci`          | Drive `pnpm ci:prepush` green. Self-heal lint/format/lockfile; escalate logic failures. Cites every Dagger lane + likely root cause.                                                  |
| `/code-review` | Parallel bench (grug + ousterhout + carmack + beck + critic) against repo invariants + ADRs 0001–0008. Verdict: `pnpm ci:prepush` green + 85% coverage.                               |
| `/deliver`     | Inner-loop composer. One `backlog.d/NNN-*.md` → merge-ready PR on `master`.                                                                                                           |
| `/deploy`      | Ships to Vercel (frontend), Convex (backend), Fly (`linejam-canary-responder`). Master-push is the production trigger.                                                                |
| `/deps`        | Audits via `pnpm ci:dagger:audit` (osv-scanner). Ships one `fix(deps):` PR per advisory cluster.                                                                                      |
| `/diagnose`    | Four-phase protocol anchored on Canary, Convex dashboard, Dagger output, `/api/health`. Linejam symptom library (guest join drops, reveal lag, Playwright flake → Clerk/Convex sync). |
| `/flywheel`    | Outer-loop orchestrator. Picks from `backlog.d/` → `/deliver` → master merge → auto-deploy → `/monitor` → `/reflect`. Respects slice 010/014 parallel-eligibility.                    |
| `/implement`   | TDD with Vitest + Playwright. Red → Green → Refactor. Respects invariants #5–#7.                                                                                                      |
| `/monitor`     | Grace-window watch on `/api/health` + Canary responder. Two-signal model (app health vs observability).                                                                               |
| `/refactor`    | Branch-aware simplification against ADRs 0001–0008. Canonical bench: grug + ousterhout + carmack.                                                                                     |
| `/settle`      | Unblock and land PRs to `master`. Respects `merge-gate` branch protection + squash-single-ticket convention.                                                                          |
| `/shape`       | Produces `backlog.d/NNN-*.md` context packet with Goal + Oracle + Invariant compliance + ADR (if architectural).                                                                      |
| `/yeet`        | Worktree-aware commit slicing + Conventional Commit push. Respects commitlint type-enum.                                                                                              |
| `/a11y`        | WCAG 2.2 AA across the four-theme × four-screen matrix. Three-agent protocol (audit → fix → critic).                                                                                  |
| `/qa`          | Browser-driven exploratory testing. Ten linejam scenarios (full game, mid-session join, theme switch, word-count violation, etc.).                                                    |

**Domain — linejam-invented:**

| Skill                     | What it does here                                                                                                                                                                              |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/convex-migrate`         | Three-phase Convex schema migration (add optional → backfill → require) with Canary-watched grace windows + ADR emission. Justified by 14 `v.optional()` fields + live traffic + Invariant #3. |
| `/assignment-matrix-test` | Property-test the derangement constraint across N=2..8 × M iterations. Replay seed on failure. Load-bearing for game correctness (ADR 0002, 0004).                                             |

**Universal — verbatim from spellbook:**

| Skill              | What it does                                                          |
| ------------------ | --------------------------------------------------------------------- |
| `/research`        | Web + delegation + thinktank.                                         |
| `/groom`           | File-driven backlog ops (`backlog.d/`).                               |
| `/office-hours`    | Gary-Tan-style raw-idea interrogation (six forcing questions).        |
| `/ceo-review`      | Premise + alternatives + outside voice + ratify.                      |
| `/reflect`         | Session retro + codification + harness branch emission.               |
| `/model-research`  | LLM model comparison (linejam uses OpenRouter/Gemini for AI players). |
| `/agent-readiness` | Parallel pillar assessment.                                           |
| `/demo`            | Evidence capture + walkthrough media.                                 |

### Agents (`.claude/agents/`)

| Agent          | Use for                                                    |
| -------------- | ---------------------------------------------------------- |
| `planner`      | Spec decomposition into builder-ready context packets.     |
| `builder`      | Heads-down implementation following a context packet.      |
| `critic`       | Evidence-based skeptic. Fail or approve, no prose hedging. |
| `beck`         | TDD + simple design.                                       |
| `carmack`      | Direct implementation, ship judgment.                      |
| `grug`         | Complexity-demon hunter.                                   |
| `ousterhout`   | Deep modules + information hiding.                         |
| `a11y-auditor` | Read-only a11y audit.                                      |
| `a11y-fixer`   | Surgical a11y fixes (native HTML > ARIA).                  |
| `a11y-critic`  | Skeptical a11y verification.                               |

## Commands Cheat Sheet

```bash
# Inner loop
pnpm dev                  # Next + Convex (user runs this — do not spawn)
pnpm test --run <path>    # Fast single-file
pnpm typecheck            # app + Dagger
pnpm lint:fix

# Gate
pnpm ci:prepush           # = pnpm ci:dagger:all (authoritative)

# Individual Dagger lanes
pnpm ci:dagger:{lint,typecheck,format-check,build-check,unit-test,e2e,audit,secret-scan,smoke,all-no-e2e,all}

# E2E variants
pnpm test:e2e             # all
pnpm test:e2e:smoke       # playwright.smoke.config.ts
pnpm test:e2e:evidence    # guest-flow authoritative spec

# Observability
pnpm canary:responder     # local webhook responder
pnpm canary:smoke         # trigger remote
pnpm canary:webhook:setup # rerunnable

# Build + release
pnpm build                # convex bootstrap + next build
pnpm generate:releases    # semantic-release

# GitHub
gh pr create / gh pr checks / gh pr merge --squash --delete-branch
```

## Critical Environment Variables

- Convex: `CONVEX_DEPLOYMENT`, `NEXT_PUBLIC_CONVEX_URL`, `CONVEX_DEPLOY_KEY`, `OPENROUTER_API_KEY`.
- Guest auth: `GUEST_TOKEN_SECRET` (must match surfaces — Invariant #8).
- Clerk: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_JWT_ISSUER_DOMAIN`.
- Canary: `CANARY_ENDPOINT`, `CANARY_API_KEY`, `NEXT_PUBLIC_CANARY_*`, `LINEJAM_CANARY_WEBHOOK_{SECRET,URL}`.
- Dagger flags: `LINEJAM_ALLOW_PROD_CONVEX_SYNC`, `LINEJAM_ALLOW_LIVE_CLERK_TEMPLATE_CREATE`, `LINEJAM_SYNC_CONVEX_BEFORE_DAGGER`.
- Playwright: `PLAYWRIGHT_BASE_URL`, `PLAYWRIGHT_CLERK_TEST_EMAIL`, `PLAYWRIGHT_REQUIRE_AUTH_{E2E,SMOKE}`.

## Terminology

Use the repo's words:

- **Poem** / **Line** / **Round** (0–8, nine total).
- **Assignment matrix** (derangement-like; ADR 0002).
- **Cycle** (one run through the nine rounds).
- **Pen name** (captured at write-time; stored on the line; ADR 0008).
- **Guest UUID** / **guest token** (signed JWT in localStorage; ADR 0001).
- **Host** / **Room code** (four-letter, formatted `AB CD` via `lib/roomCode.ts`).
- **Reveal phase** (each player assigned one poem to read aloud).
- **Dagger** / **Dagger lane** (the pipeline; not "CI" generically).
- **Canary** (the incident sink + Fly webhook responder).
