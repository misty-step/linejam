# Repository Guidelines

## Project Structure & Modules

- `app/`: Next.js 16 routes; `page.tsx` for root play flow; feature folders (`host/`, `join/`, `room/`, `poem/`, `me/`); API routes in `app/api/`.
- `components/`: Reusable UI; keep props minimal; prefer composition over config flags.
- `lib/`: Domain helpers (word counts, assignment matrix, logging, themes); exports must hide implementation choices.
- `lib/themes/`: Premium theme system with 4 presets (kenya, mono, vintage-paper, hyper).
- `hooks/`: React hooks (useSharePoem for clipboard sharing).
- `convex/`: Convex functions + schemas; treat as backend boundary.
- `convex/lib/ai/`: AI player LLM integration (OpenRouter/Gemini).
- `public/`: Static assets; fonts live here.
- `tests/`: Vitest unit/integration + Playwright E2E; structure mirrors source.

## Build, Test, Dev Commands

- `pnpm dev`: Run Next + Convex together.
- `pnpm build`: Run the hosted Convex bootstrap/deploy wrapper in `scripts/ci/bootstrap-convex-env.mjs` before `next build` (`build:check`).
- `pnpm lint` / `pnpm lint:fix`: ESLint (Next core-web-vitals).
- `pnpm format` / `pnpm format:check`: Prettier 3 over code+docs.
- `pnpm typecheck`: `tsc --noEmit`.
- `pnpm test`: Vitest happy-dom; `pnpm test:ci` adds coverage; `pnpm test:watch`/`test:ui` for local loops.
- `pnpm test:e2e`: Playwright E2E tests; `pnpm test:e2e:ui` for interactive mode.

## Coding Style & Naming

- TypeScript everywhere; aliases via `@` to repo root.
- Components, hooks: PascalCase files; utility modules: camelCase.
- Prefer server components; mark client components explicitly.
- Styling: Tailwind CSS v4; keep class lists small; factor repeated patterns into components.
- Formatting enforced by Prettier; 2-space indent; no unused exports (ESLint).

## Testing Guidelines

- Framework: Vitest + Testing Library + happy-dom for unit/integration; Playwright for E2E.
- File pattern: `**/*.{test,spec}.{ts,tsx}` near source or under `tests/`; E2E in `tests/e2e/`.
- Coverage thresholds: 85% lines/branches/functions/statements; see `vitest.config.ts`.
- 500+ tests total across unit, integration, and E2E layers.
- Mock external calls (Clerk, Convex) at module boundary; avoid reaching network.

## Commit & PR Guidelines

- Conventional commits enforced by commitlint (`feat:`, `fix:`, `chore:`, etc.).
- Lefthook pre-commit auto-runs `eslint --fix` + `prettier --write`; let it stage fixes.
- Pre-push runs the local Dagger contract via `pnpm ci:prepush`; keep it green before PR. Local Dagger is the source of truth and auto-syncs the active Convex dev backend before auth-heavy E2E unless you explicitly disable that behavior.
- The default Dagger E2E contract includes authenticated Clerk coverage. Keep Clerk secrets configured unless you are intentionally running a guest-only loop; `PLAYWRIGHT_CLERK_TEST_EMAIL` is optional for dev/test Clerk keys because the Playwright helper can provision the default smoke user there, but live Clerk keys must point at a precreated smoke account.
- Local Dagger ensures the Clerk `convex` JWT template exists before local auth-heavy browser coverage. Keep `LINEJAM_ALLOW_LIVE_CLERK_TEMPLATE_CREATE=0` unless you explicitly intend to mutate a live Clerk instance.
- The authoritative Dagger contract requires real `NEXT_PUBLIC_CANARY_ENDPOINT` and `NEXT_PUBLIC_CANARY_API_KEY` values for build-bearing lanes. Do not paper over missing Canary browser config with placeholders.
- Local Dagger will not push Convex production code unless `LINEJAM_ALLOW_PROD_CONVEX_SYNC=1` is set explicitly.
- Local Dagger loads `.env.local` after `.env.production.local`, so localhost-safe Clerk keys from `.env.local` win during the local contract.
- PRs: concise description, linked issue/card, screenshots for UI changes, list risky areas or TODO debt.

## Security & Config

- Copy `.env.example` → `.env.local`; fill Convex and Clerk keys; never commit secrets.
- `GUEST_TOKEN_SECRET` must match in Vercel and Convex for token verification.
- `OPENROUTER_API_KEY` in Convex for AI player functionality.
- Canary is the primary observability sink. Keep `CANARY_*` and responder env
  vars documented in `.env.example`.
- Local Dagger is still authoritative, but hosted responders should use
  `LINEJAM_SMOKE_RUNNER=playwright` so they can execute the remote smoke suite
  without embedding Dagger in the webhook worker.
- `pnpm canary:webhook:setup` is the canonical CLI for wiring the responder to
  Canary. It should be safe to rerun and should not accumulate duplicate
  subscriptions for the same responder URL.
- `/api/health` reports core app health separately from Canary readiness. Do not treat missing Canary ingest as proof that the game service is down.
- Use `pnpm` only (`preinstall` enforces); Node ≥22.

## Key Features

- **AI Players**: Host can add AI players in lobby; uses OpenRouter/Gemini for line generation.
- **Themes**: 4 premium themes via `lib/themes/` (kenya, mono, vintage-paper, hyper).
- **Sharing**: `useSharePoem` hook for clipboard sharing with analytics.
- **Help Modal**: Floating "?" button explains gameplay mechanics.
