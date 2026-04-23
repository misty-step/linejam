# Linejam Repo Brief

_Shared spine for tailored skills and routers. Cite these anchors verbatim. Do
not invent parallel vocabulary._

## Vision & Purpose

Linejam is a real-time collaborative poetry party game. Players contribute
lines under tight word-count constraints across nine rounds
(`1,2,3,4,5,4,3,2,1`), seeing only the previous line before writing. The core
value is the reveal: absurd, communal poems that no one participant could have
written alone.

The repo serves a production-minded Next.js + Convex app with optional Clerk
auth, signed guest tokens, AI player support through OpenRouter, premium themes,
and post-session sharing. The current product posture is polish and operational
reliability, not feature sprawl.

## Stack & Boundaries

| Layer          | Owns                                                                                                                                                |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/`         | Next.js 16 App Router routes, API handlers, page-level orchestration. Feature folders include `(auth)/`, `host/`, `join/`, `room/`, `poem/`, `me/`. |
| `components/`  | UI primitives plus game surfaces such as `Lobby`, `WritingScreen`, `RevealPhase`, `RoomChrome`, and `CanaryClientObserver.tsx`.                     |
| `convex/`      | Backend schema, queries, mutations, actions, scheduler, generated API surface.                                                                      |
| `convex/lib/`  | Auth helpers, assignment matrix logic, AI personas/providers, structured errors.                                                                    |
| `lib/`         | Frontend domain utilities: auth hook, logger, error capture, room-code formatting, word counting, user-facing error text.                           |
| `lib/themes/`  | Theme presets and provider. Four presets: `kenya`, `mono`, `vintage-paper`, `hyper`.                                                                |
| `lib/posthog/` | Canonical product analytics surface. `lib/analytics.ts` still carries Vercel Analytics legacy wiring.                                               |
| `tests/`       | Vitest unit/integration and Playwright E2E.                                                                                                         |
| `dagger/`      | TypeScript Dagger pipeline; authoritative local engineering gate.                                                                                   |
| `scripts/`     | CI bootstrap, Canary responder/smoke tooling, evidence capture, claims helper.                                                                      |
| `backlog.d/`   | Authoritative backlog. Numbered markdown files with Goal + Oracle.                                                                                  |
| `docs/adr/`    | ADRs 0001–0008.                                                                                                                                     |

Ground-truth pointers:

- `convex/_generated/api.d.ts` — generated Convex API surface.
- `convex/schema.ts` — source of truth for data model.
- `convex/lib/assignmentMatrix.ts` — load-bearing derangement-like assignment logic.
- `dagger/src/index.ts` — authoritative gate implementation.
- `lefthook.yml` — local hook enforcement.
- `docs/testing.md` — actual test entrypoints and environment contract.
- `docs/ops/canary-responder.md` — responder operating contract.

## Load-Bearing Gate

**`pnpm ci:prepush` IS the gate.** It shells to `pnpm ci:dagger:all`, which
runs the Dagger module in `dagger/src/index.ts`.

Every gate-adjacent skill cites that sentence verbatim. Do not rename it to
"CI", "the pipeline", or "the Dagger run" in one place and something else in
another.

Current gate composition:

- `format-check`
- `lint`
- `typecheck`
- `secret-scan`
- `audit`
- `unit-test` with 85% coverage floor
- `build-check`
- `e2e`

Supporting facts:

- Lefthook pre-push runs `pnpm ci:prepush`.
- Lefthook pre-commit runs `gitleaks protect`, `eslint --fix`, and
  `prettier --write`.
- Hosted GitHub Actions mirrors much of the contract but is not perfectly
  minimal yet: `.github/workflows/ci.yml` still runs split jobs
  (`quality-gates`, `test-build`, `e2e`, `qa-evidence`), and
  `.github/workflows/trufflehog.yml` still duplicates secret scanning.
- Preview and prod smoke are separate hosted workflows.

## Invariants

1. **Never push on red Dagger.** `pnpm ci:prepush` must be green. Never use
   `--no-verify`.
2. **Never run `pnpm dev`, `pnpm dev:convex`, `convex dev`, or other local
   server processes yourself.** The user runs them in a separate terminal.
3. **Never deploy Convex production without
   `LINEJAM_ALLOW_PROD_CONVEX_SYNC=1`.** The speed bump is intentional.
4. **Never rely on placeholder Canary browser keys in build-bearing lanes.**
   `NEXT_PUBLIC_CANARY_*` must be real where the Dagger contract requires them.
5. **Never mock internal `@/` or `../../` modules in tests.** Mock only system
   boundaries and nondeterminism.
6. **Parallelize independent Convex writes with `Promise.all`.** Avoid
   sequential write loops and obvious N+1 query shapes.
7. **Every `while` loop needs a termination guard.** Infinite-loop test hangs
   are unacceptable.
8. **`GUEST_TOKEN_SECRET` must match across local, Vercel, and Convex.**
   Mismatch silently breaks guest joins.
9. **Base branch is `master`.** Conventional Commits only.
10. **`backlog.d/` is authoritative; GitHub Issues are empty by design.**

## Known Debts

Only include debts that are grounded in the current checkout or current
backlog.

| Debt                                                                                                                                            | Pointer                                                                                         | Tracker                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Local bootstrap path still missing                                                                                                              | `.env.example`, `scripts/setup.sh` absent                                                       | `backlog.d/003-bootstrap-local-dev-loop.md`               |
| Release governance docs still missing                                                                                                           | `CODEOWNERS`, `SECURITY.md`, `CONTRIBUTING.md` absent                                           | `backlog.d/004-establish-release-governance-baseline.md`  |
| Critical room/session flows lack request-level telemetry                                                                                        | `app/api/health/route.ts`, `app/api/guest/session/route.ts`, `lib/logger.ts`, `lib/error.ts`    | `backlog.d/005-add-request-telemetry-for-room-flows.md`   |
| Post-reveal handoff remains blocked                                                                                                             | `components/RevealPhase.tsx`, `components/PoemDisplay.tsx`, `components/RoomChrome.tsx`         | `backlog.d/006-build-post-reveal-session-hub.md`          |
| Agentic exploratory QA lane is not built yet                                                                                                    | `playwright.smoke.config.ts`, `scripts/canary/responder.mjs`, `docs/testing.md`                 | `backlog.d/007-establish-stagehand-agentic-qa-harness.md` |
| Analytics migration remains partial                                                                                                             | `lib/analytics.ts`, `lib/posthog/`                                                              | On-touch migration; no separate backlog item yet          |
| Hosted CI still carries duplicated/advisory lanes (`qa-evidence`, `trufflehog`, Gemini release-note synthesis) beyond the local Dagger contract | `.github/workflows/ci.yml`, `.github/workflows/trufflehog.yml`, `.github/workflows/release.yml` | No shaped backlog item yet                                |

Cerberus is out. Do not resurrect it.

## Terminology

Use the repo's words:

- **Poem**
- **Line**
- **Round**
- **Assignment matrix**
- **Cycle**
- **Pen name**
- **Guest UUID** / **guest token**
- **Host**
- **Room code**
- **Reveal phase**
- **Dagger** / **Dagger lane**
- **Canary**

## Session Signal

Recurring corrections and validated patterns from prior sessions:

- The user wants **divergence before convergence** on non-trivial design work:
  multiple structurally distinct shapes, not one recommendation with costume
  changes.
- The user wants **full-solve behavior**: if a gate, advisory, or adjacent
  breakage is encountered during the task, fix it rather than dismissing it as
  pre-existing.
- **PostHog is the product analytics direction.** `lib/analytics.ts` is legacy
  Vercel Analytics surface, not the preferred place for new event design.
- **Prompt injection in the OpenRouter provider is explicitly deprioritized**
  for now; do not keep resurfacing it unless the user asks.
- **The user runs the dev servers.** Agents should not spawn them.
- **Backlog files, not GitHub Issues, are the planning source of truth.**

Validated working patterns:

- `pnpm ci:prepush` as the single local gate.
- `backlog.d/NNN-*.md` with Goal + Oracle as the planning unit.
- Canary-first incident/observability posture; PostHog is for product analytics,
  not incident handling.
- Parallel investigation benches for architecture and workflow design.

## Commands Cheat Sheet

```bash
# Inner loop
pnpm test --run <path>
pnpm test:watch
pnpm typecheck
pnpm lint:fix

# Gate
pnpm ci:prepush
pnpm ci:dagger:{lint,typecheck,format-check,build-check,unit-test,e2e,audit,secret-scan,smoke,all-no-e2e,all}

# E2E
pnpm test:e2e
pnpm test:e2e:smoke
pnpm test:e2e:evidence
pnpm test:e2e:ui

# Canary / evidence
pnpm canary:responder
pnpm canary:smoke
pnpm canary:webhook:setup
pnpm evidence:guest-flow

# Release
pnpm build
pnpm generate:releases

# Backlog claiming
source scripts/lib/claims.sh
claim_acquire <backlog-id>
claim_release <backlog-id>
```
