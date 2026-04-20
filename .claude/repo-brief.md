# Linejam Repo Brief

_Shared spine for every tailored skill. Cite these anchors verbatim — do not invent parallel vocabulary._

## Vision & Purpose

Linejam is a real-time collaborative party game. Friends (same room or remote) contribute lines to shared poems under tight word-count constraints (1,2,3,4,5,4,3,2,1 words across nine rounds), only ever seeing the previous line before writing. The reveal reads as absurdist communal verse — the joy is the surprise. AI players (Gemini via OpenRouter) fill empty seats so two humans can still play a four-poem game.

Stack is Next.js 16 (React 19, App Router) + Convex 1.31 backend + Tailwind CSS 4 + Clerk 6 (optional) + signed guest JWTs. Node 22, pnpm 10.22. TypeScript strict throughout.

## Stack & Boundaries

| Layer          | Owns                                                                                                                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `app/`         | Next.js App Router routes. Client-first (`'use client'` explicit). Feature folders: `(auth)/`, `host/`, `join/`, `room/`, `poem/`, `me/`. API routes live in `app/api/` (guest session, health). |
| `components/`  | UI primitives (Button, Card, Input) + game screens (Lobby, WritingScreen, RevealPhase, RoomChrome) + `CanaryClientObserver.tsx`.                                                                 |
| `convex/`      | Backend schema, queries, mutations, actions, scheduler. All typed via generated `convex/_generated/api.d.ts`.                                                                                    |
| `convex/lib/`  | Auth (`auth.ts`), assignment matrix (`assignmentMatrix.ts`), AI personas (`ai/personas.ts`), OpenRouter provider (`ai/providers/openrouter.ts`), structured errors (`errors.ts`).                |
| `lib/`         | Frontend domain: `auth.ts` (useUser hook), `logger.ts`, `error.ts` (captureError), `wordCount.ts`, `roomCode.ts`, `errorFeedback.ts`, `cn.ts`.                                                   |
| `lib/themes/`  | Theme system: four presets (kenya default, mono, vintage-paper, hyper), CSS variable injection, ThemeProvider context.                                                                           |
| `lib/posthog/` | Product analytics (PostHog). Primary analytics surface; Vercel Analytics phasing out.                                                                                                            |
| `hooks/`       | React hooks (useSharePoem, useTheme).                                                                                                                                                            |
| `tests/`       | Vitest unit/integration + `tests/e2e/` Playwright specs. Setup in `tests/setup.ts` (localStorage shim).                                                                                          |
| `dagger/`      | TypeScript Dagger SDK pipeline (~800 LOC in `dagger/src/index.ts`). Orchestrates lint/build/test/e2e in containers.                                                                              |
| `scripts/`     | CI bootstrap (`ci/bootstrap-convex-env.mjs`), Canary responder (`canary/responder.mjs`), evidence recording, claim lib (`scripts/lib/claims.sh`).                                                |
| `docs/adr/`    | Architecture decision records (0001–0008 filed).                                                                                                                                                 |
| `backlog.d/`   | **Authoritative** file-driven backlog. Each item numbered with Priority/Status/Estimate/Goal/Oracle.                                                                                             |

Ground-truth pointers (stale training data lies — always read these):

- `convex/_generated/api.d.ts` — auto-generated on every `convex dev` / `pnpm build`. This is _the_ Convex API surface.
- `convex/schema.ts` — 10 tables with indexes. Source of truth for data model.
- `convex/lib/assignmentMatrix.ts` — derangement algorithm. Mutating this changes game correctness.
- `lib/themes/presets/*.ts` — concrete theme tokens.
- `dagger/src/index.ts` — gate behavior. If `pnpm ci:prepush` behaves unexpectedly, read this first.

## Load-Bearing Gate

**`pnpm ci:prepush` IS the gate.** It shells to `pnpm ci:dagger:all`, which runs the local Dagger pipeline: lint, format-check, typecheck (app + Dagger), audit, build-check, unit-test with coverage, secret-scan, and Playwright E2E (including authenticated coverage).

Every gate-adjacent skill cites this verbatim. Do not rename it "CI", "the pipeline", or "prepush checks" in one skill and "the Dagger gate" in another.

Supporting facts:

- Lefthook pre-push hook runs `pnpm ci:prepush`. You cannot push on a red Dagger run without `git push --no-verify` — and that is forbidden.
- Lefthook pre-commit runs parallel gitleaks + `eslint --fix` + `prettier --write` (with `stage_fixed: true`).
- Lefthook commit-msg runs commitlint (Conventional Commits).
- GitHub Actions (`.github/workflows/ci.yml`) mirrors the Dagger contract remotely and enforces branch protection. Local Dagger is authoritative; hosted CI is secondary confirmation.
- Dagger lanes runnable individually: `pnpm ci:dagger:{lint,format-check,typecheck,build-check,unit-test,e2e,audit,secret-scan,smoke,all,all-no-e2e}`.
- Coverage threshold: **85%** (lines, branches, functions, statements), enforced in `vitest.config.ts` and the unit-test lane.

## Invariants

These are hard rules. Violating them breaks something load-bearing.

1. **Never push on red Dagger.** Pre-push hook enforces this; never bypass with `--no-verify`. If you think the hook is wrong, fix the hook or the gate, don't evade it.
2. **Never run `convex dev` or server processes yourself — ask the user.** The user keeps Convex/Next dev servers running in a separate terminal. Spawning duplicates kills schema sync.
3. **Never commit Convex production without `LINEJAM_ALLOW_PROD_CONVEX_SYNC=1`.** Dagger refuses by default; the flag is an intentional speed bump, not a nuisance.
4. **Never push placeholder Canary keys.** `NEXT_PUBLIC_CANARY_ENDPOINT` + `NEXT_PUBLIC_CANARY_API_KEY` must be real values in build-bearing lanes. The contract fails fast on placeholders by design.
5. **Never mock `@/` or `../../` paths in tests.** Mock only at system boundaries (Convex/react, @clerk/nextjs, fetch, localStorage, clipboard, Date.now, Math.random). Mocking internal collaborators (auth helpers, avatarColor, wordCount) is forbidden by CLAUDE.md.
6. **Never batch sequential DB writes when you can `Promise.all`.** Convex mutations loop through items — use parallel writes. N+1 queries get batched via `q.or()`.
7. **Every `while` loop needs a termination guard.** Bounded iterations only. Infinite-loop test hangs have cost us real time; this rule is non-negotiable.
8. **`GUEST_TOKEN_SECRET` must match in Vercel + Convex + local `.env.local`.** Mismatch silently drops guest joins. Bootstrap script validates this on build.
9. **Base branch for PRs is `master`.** Conventional Commits only. Commitlint blocks non-compliant messages.
10. **Backlog source-of-truth is `backlog.d/`, NOT GitHub Issues.** As of 2026-04-20 there are zero open GH issues. File work as numbered markdown (NNN-kebab-title.md) with Goal + Oracle.

## Known Debts

Pulled from recent session history, `backlog.d/`, and hot-file signal. Each has a concrete file pointer.

| Debt                                         | Pointer                                                                                             | Notes                                                                                                                                                                                                                     |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CI redesign (SHAPE-E promotion gate)         | `docs/ci/redesign-2026Q2.md`, `backlog.d/` slices 010–015                                           | In-flight. Slice 010 (preview lane) + 014 (convex-test + mock-boundary lint) are independent and ready. 011/012/013 serialize on 010. 015 lands last. Ratio baseline 33:8 fix:feat; target ≤2:1 within one release cycle. |
| `useQuery` has no error state                | `convex/_generated/api.d.ts` (library), all `useQuery` call sites                                   | Error boundaries are the mitigation. Convex 1.x limitation.                                                                                                                                                               |
| N+1 author fetches in `getRevealPhaseState`  | `convex/game.ts`                                                                                    | Covered by backlog but unpatched. Batch with `q.or()` when touched.                                                                                                                                                       |
| PostHog vs. Vercel Analytics dual-write      | `lib/analytics.ts` (Vercel, 6 events), `lib/posthog/` (canonical)                                   | New event work routes through PostHog. When touching `lib/analytics.ts`, migrate the event.                                                                                                                               |
| Prompt injection in OpenRouter provider      | `convex/lib/ai/providers/openrouter.ts`                                                             | User deprioritized ("idc about prompt injection here really"). Do not re-raise unless the AI surface expands beyond trusted-user multiplayer poetry.                                                                      |
| Browser-agent bake-off                       | `backlog.d/008-*` (4-way: Playwright 1.59 / Stagehand v3 / browser-use / Vercel Labs agent-browser) | Blocks #007.                                                                                                                                                                                                              |
| `/api/health` vs Canary readiness conflation | `app/api/health/route.ts`, `components/CanaryClientObserver.tsx`                                    | Health should report app health separately from Canary ingest; missing Canary is degraded observability, not a gameplay outage.                                                                                           |
| No `.glance.md`, no `docs/CODEBASE_MAP.md`   | Repo root + `docs/`                                                                                 | `/tune-repo` never run. Not blocking but navigation surface is thinner than ideal.                                                                                                                                        |

Cerberus is **out** (workflow deleted in `5dc890c`). Don't resurrect it. The browser-use / Stagehand bake-off (#008) is the current replacement conversation.

## Terminology

Use the repo's words, not generic ones.

- **Poem**, not document/entry/thread.
- **Line**, not entry/submission/message.
- **Round**, not step/turn/phase (rounds 0–8, nine total).
- **Assignment matrix**, not schedule/roster/rotation.
- **Pen name**, not nickname/display name (captured at write-time, stored on the line).
- **Guest UUID** / **guest token**, not anonymous ID / visitor (signed JWT in localStorage).
- **Host**, not admin/owner (first player to open a room).
- **Cycle**, not session/game-instance (one run through nine rounds).
- **Room code**, not game ID / session ID (four-letter, formatted `AB CD`).
- **Reveal phase**, not reveal/endgame/reading (each player assigned one poem to read aloud).
- **Dagger**, **Dagger lane** — the concrete pipeline, not "the CI" generically.
- **Canary** — the incident sink + webhook responder. Primary observability surface on the client.

## Session Signal

Recurring corrections (from 2026-Q1/Q2 session JSONL at `~/.claude/projects/-Users-phaedrus-Development-linejam/`):

- **"Get rid of X; we're not using it."** When the user says something is gone, it's gone. Don't propose retention. (Cerberus, branch protection in-repo.)
- **"What are all the different shapes?"** When offering a design, bring ≥2 structurally distinct options, not one recommendation dressed as the answer. (`feedback_divergence_for_design_decisions.md`.)
- **"idc about X here really."** Some things the user explicitly deprioritizes. Don't re-raise. (Prompt injection in the AI provider is the canonical example.)
- **"Tidy up the workspace."** User gives ownership; act with authority. Don't hedge on deleting ephemera when explicitly asked.
- **"Git push is failing. Investigate and fix."** Dagger is the source of truth. Don't propose local workarounds; diagnose the Dagger lane.
- **"Update or nix project.md."** Spec docs track current state immediately, not lazily.
- **Fix-everything-on-encounter mandate.** See `feedback_fix_everything_on_encounter.md`. Patch gates, advisories, memory as encountered. No "pre-existing, not my scope" excuses. Boil the ocean.

Validated patterns (quieter signal, user accepted without pushback):

- **Parallel subagent dispatch (Thinktank + Gemini + Codex + fresh-context subagents)** for non-trivial architectural decisions.
- **Backlog.d numbered markdown files with Goal + Oracle** — stable format, no JSON, no DB.
- **Flywheel stage decomposition** (shape → implement → ci/code-review/refactor → land → deploy-wait → monitor → reflect).
- **`pnpm ci:prepush` as the single gate** — nobody asks for a different gate.
- **Canary-first observability** over PostHog for incidents; PostHog is for product analytics only.

## Commands Cheat Sheet

```bash
# Inner loop
pnpm dev                   # Next + Convex in parallel (user runs this separately)
pnpm test --run <path>     # Fast single-file unit
pnpm test:watch            # Interactive
pnpm typecheck             # app + Dagger
pnpm lint:fix              # eslint --fix

# Pre-push (authoritative gate)
pnpm ci:prepush            # = pnpm ci:dagger:all

# Individual Dagger lanes
pnpm ci:dagger:lint
pnpm ci:dagger:typecheck
pnpm ci:dagger:format-check
pnpm ci:dagger:build-check
pnpm ci:dagger:unit-test
pnpm ci:dagger:e2e
pnpm ci:dagger:audit
pnpm ci:dagger:secret-scan
pnpm ci:dagger:smoke
pnpm ci:dagger:all-no-e2e  # skip browsers (~90s target)
pnpm ci:dagger:all         # full (~5min target)

# E2E variants
pnpm test:e2e              # all Playwright except @evidence
pnpm test:e2e:smoke        # playwright.smoke.config.ts
pnpm test:e2e:evidence     # guest-flow, single worker, no retries
pnpm test:e2e:ui           # interactive

# Canary observability
pnpm canary:responder      # start local webhook responder
pnpm canary:smoke          # trigger remote smoke
pnpm canary:webhook:setup  # register webhook (rerunnable, converges on one sub)

# Release & deploy
pnpm build                 # convex bootstrap + next build
pnpm generate:releases     # semantic-release

# Git + GitHub
gh pr create / gh pr checks / gh pr merge
gh issue list  # expected to be empty — backlog.d/ is authoritative
```

## Environment Variables (Critical Subset)

- Convex: `CONVEX_DEPLOYMENT`, `NEXT_PUBLIC_CONVEX_URL`, `CONVEX_DEPLOY_KEY`, `OPENROUTER_API_KEY` (backend only).
- Guest auth: `GUEST_TOKEN_SECRET` (must match across Vercel + Convex + local).
- Clerk: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_JWT_ISSUER_DOMAIN`.
- Canary: `CANARY_ENDPOINT`, `CANARY_API_KEY`, `NEXT_PUBLIC_CANARY_*`, `LINEJAM_CANARY_WEBHOOK_SECRET`, `LINEJAM_CANARY_WEBHOOK_URL`.
- Dagger gates: `LINEJAM_ALLOW_PROD_CONVEX_SYNC`, `LINEJAM_ALLOW_LIVE_CLERK_TEMPLATE_CREATE`, `LINEJAM_SYNC_CONVEX_BEFORE_DAGGER`.
- Playwright: `PLAYWRIGHT_BASE_URL`, `PLAYWRIGHT_CLERK_TEST_EMAIL`, `PLAYWRIGHT_REQUIRE_AUTH_E2E`, `PLAYWRIGHT_REQUIRE_AUTH_SMOKE`.

## Gotchas

1. `convex/_generated/api.d.ts` regenerates on `convex dev` — if types drift, run `pnpm dev:convex` (or ask the user) before trusting call sites.
2. Guest JWT signing secret mismatch silently drops joins. Validate `GUEST_TOKEN_SECRET` parity across surfaces.
3. Word counting uses `lib/wordCount.ts` — space-split heuristic; hyphenated words count as one. Client + server validation must agree.
4. `useQuery` errors are thrown, not returned. Wrap in ErrorBoundary or `data === undefined && !isLoading` patterns.
5. Clerk `convex` JWT template must exist in the Clerk instance. Dagger auto-creates on dev unless `LINEJAM_ALLOW_LIVE_CLERK_TEMPLATE_CREATE=0`.
6. Theme context is global — tests that touch it need cleanup to prevent leakage.
7. Vitest pool is `threads` with `maxWorkers: 1` to avoid Node 22 fork teardown hang. Don't change it speculatively.
8. Playwright flake is usually Clerk smoke-account drift or Convex dev deployment out-of-sync — investigate those two before blaming the test.
