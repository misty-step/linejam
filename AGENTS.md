# AGENTS.md — Linejam Router

One-page map for AI agents. Not a manual. Read the linked files when you need
depth.

## Stack & Boundaries

| Layer          | Version                 | Owns                                                                                                                   |
| -------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `app/`         | Next.js 16.2 / React 19 | Routes, API handlers, page-level orchestration. Feature folders: `(auth)/`, `host/`, `join/`, `room/`, `poem/`, `me/`. |
| `components/`  | React 19                | UI primitives plus `Lobby`, `WritingScreen`, `RevealPhase`, `RoomChrome`, `CanaryClientObserver.tsx`.                  |
| `convex/`      | Convex 1.31             | Backend schema, queries, mutations, actions, scheduler, generated API surface.                                         |
| `convex/lib/`  | —                       | Auth, assignment matrix, AI personas/providers, structured errors.                                                     |
| `lib/`         | —                       | Frontend domain utilities: auth, logger, error capture, room-code, word-count, error feedback.                         |
| `lib/themes/`  | —                       | Theme presets and provider. Presets: `kenya`, `mono`, `vintage-paper`, `hyper`.                                        |
| `lib/posthog/` | PostHog                 | Canonical product analytics surface. `lib/analytics.ts` is legacy Vercel Analytics wiring.                             |
| `tests/`       | Vitest 4 + Playwright   | Unit/integration plus `tests/e2e/`.                                                                                    |
| `dagger/`      | Dagger TypeScript SDK   | Authoritative local gate.                                                                                              |
| `scripts/`     | Node ESM + shell        | CI bootstrap, Canary responder/smoke tooling, evidence capture, claims helper.                                         |
| `backlog.d/`   | Markdown                | Authoritative backlog.                                                                                                 |
| `docs/adr/`    | Markdown                | ADRs 0001–0008.                                                                                                        |

## Ground-Truth Pointers

Read these when you need the truth:

- `project.md` — product north star: vision, current focus, anti-goals. Read first to know what excellence means here before changing direction.
- `convex/_generated/api.d.ts` — current Convex API surface.
- `convex/schema.ts` — source of truth for data model.
- `convex/lib/assignmentMatrix.ts` — load-bearing derangement-like assignment logic.
- `dagger/src/index.ts` — what the gate actually runs.
- `lefthook.yml` — local hook enforcement.
- `docs/testing.md` — actual test commands and environment contract.
- `docs/ops/canary-responder.md` — Canary responder operating contract.

## Invariants

1. **Never push on red `pnpm ci:prepush`.** Pre-push runs the fast Docker-free subset (typecheck + lint + test); it must be green. Never use `--no-verify`.
2. **Never run `pnpm dev`, `pnpm dev:convex`, `convex dev`, or other local server processes yourself.** The user runs them elsewhere.
3. **Never deploy Convex production without `LINEJAM_ALLOW_PROD_CONVEX_SYNC=1`.**
4. **Never rely on placeholder Canary browser keys in build-bearing lanes.**
5. **Never mock internal `@/` or `../../` modules in tests.** Mock only system boundaries and nondeterminism.
6. **Parallelize independent Convex writes with `Promise.all`.** Avoid sequential write loops and obvious N+1 query shapes.
7. **Every `while` loop needs a termination guard.**
8. **`GUEST_TOKEN_SECRET` must match across local, Vercel, and Convex.**
9. **Base branch is `master`.** Conventional Commits only.
10. **`backlog.d/` is authoritative; GitHub Issues are empty by design.**

## Gate Contract

**Pre-push runs the fast, Docker-free subset, not the full Dagger contract.**
`pnpm ci:prepush` = `typecheck` + `lint` + `test` (no Docker, ~45s, can't OOM).
The monolithic `dagger-call.sh all` was removed from pre-push on 2026-06-21
because it crammed build + authenticated browser E2E into one engine and
OOM-killed (exit 137) on memory-limited machines.

The **authoritative** full contract is the hosted `merge-gate`
(`.github/workflows/ci.yml`) — the same Dagger functions decomposed across
parallel runners, enforced by branch protection. Run `pnpm ci:dagger:all` on
demand for full local fidelity (one monolithic engine; wants ample Docker
memory).

Full-contract composition (hosted / on-demand):

- `format-check`
- `lint`
- `typecheck`
- `secret-scan`
- `audit`
- `unit-test` with 85% coverage floor
- `build-check`
- `e2e`

Local enforcement:

- Pre-commit: `gitleaks protect`, `eslint --fix`, `prettier --write`
- Pre-push: `pnpm ci:prepush` (fast subset only)
- Commit-msg: commitlint

Hosted workflows:

- `.github/workflows/ci.yml` — authoritative `merge-gate`: `quality-gates`, `test-build`, `e2e`, advisory `qa-evidence`
- `.github/workflows/preview-smoke.yml` — preview smoke
- `.github/workflows/prod-smoke.yml` — production smoke
- `.github/workflows/release.yml` — semantic-release plus note synthesis
- `.github/workflows/trufflehog.yml` — extra hosted secret scan

The hosted `merge-gate` is authoritative; `pnpm ci:dagger:all` mirrors it
locally on demand. Pre-push is the fast pre-filter, not the gate.

## Known-Debt Map

No open known-debt rows. See `backlog.d/_done/` for archived items.

Cerberus is out. Do not resurrect it.

## Commands Cheat Sheet

```bash
# Inner loop
pnpm test --run <path>
pnpm test:watch
pnpm typecheck
pnpm lint:fix

# Gate
pnpm ci:fast
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

## Critical Environment Variables

- Convex: `CONVEX_DEPLOYMENT`, `NEXT_PUBLIC_CONVEX_URL`, `CONVEX_DEPLOY_KEY`, `OPENROUTER_API_KEY`
- Guest auth: `GUEST_TOKEN_SECRET`
- Clerk: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_JWT_ISSUER_DOMAIN`
- Canary: `CANARY_ENDPOINT`, `CANARY_API_KEY`, `NEXT_PUBLIC_CANARY_*`, `LINEJAM_CANARY_WEBHOOK_{SECRET,URL}`
- Dagger flags: `LINEJAM_ALLOW_PROD_CONVEX_SYNC`, `LINEJAM_ALLOW_LIVE_CLERK_TEMPLATE_CREATE`, `LINEJAM_SYNC_CONVEX_BEFORE_DAGGER`
- Playwright: `PLAYWRIGHT_BASE_URL`, `PLAYWRIGHT_CLERK_TEST_EMAIL`, `PLAYWRIGHT_REQUIRE_AUTH_{E2E,SMOKE}`

## Terminology

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
