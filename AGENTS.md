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
- `pnpm build`: Deploy via `npx convex deploy` then `next build` (`build:check`).
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
- Coverage thresholds: 80% lines/branches/statements, 60% functions; see `vitest.config.ts`.
- 500+ tests total across unit, integration, and E2E layers.
- Mock external calls (Clerk, Convex) at module boundary; avoid reaching network.

## Commit & PR Guidelines

- Conventional commits enforced by commitlint (`feat:`, `fix:`, `chore:`, etc.).
- Lefthook pre-commit auto-runs `eslint --fix` + `prettier --write`; let it stage fixes.
- Pre-push runs typecheck + `test:ci` + `build:check`; keep hooks green before PR.
- PRs: concise description, linked issue/card, screenshots for UI changes, list risky areas or TODO debt.

## Security & Config

- Copy `.env.example` → `.env.local`; fill Convex and Clerk keys; never commit secrets.
- `GUEST_TOKEN_SECRET` must match in Vercel and Convex for token verification.
- `OPENROUTER_API_KEY` in Convex for AI player functionality.
- Sentry configs in `sentry.*.config.ts`; keep DSN in env vars.
- Use `pnpm` only (`preinstall` enforces); Node ≥18.

## Key Features

- **AI Players**: Host can add AI players in lobby; uses OpenRouter/Gemini for line generation.
- **Themes**: 4 premium themes via `lib/themes/` (kenya, mono, vintage-paper, hyper).
- **Sharing**: `useSharePoem` hook for clipboard sharing with analytics.
- **Help Modal**: Floating "?" button explains gameplay mechanics.
