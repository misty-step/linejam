# Repository Guidelines

## Project Structure & Modules

- `app/`: Next.js 16 routes; `page.tsx` for root play flow; feature folders (`host/`, `join/`, `room/`, `poem/`, `me/`); API routes in `app/api/` (add health here).
- `components/`: Reusable UI; keep props minimal; prefer composition over config flags.
- `lib/`: Domain helpers (word counts, assignment matrix, logging); exports must hide implementation choices.
- `convex/`: Convex functions + schemas; treat as backend boundary.
- `public/`: Static assets; fonts live here.
- `tests/`: Vitest specs; structure mirrors source; setup via `tests/setup.ts`.

## Build, Test, Dev Commands

- `pnpm dev`: Run Next + Convex together.
- `pnpm build`: Deploy via `npx convex deploy` then `next build` (`build:check`).
- `pnpm lint` / `pnpm lint:fix`: ESLint (Next core-web-vitals).
- `pnpm format` / `pnpm format:check`: Prettier 3 over code+docs.
- `pnpm typecheck`: `tsc --noEmit`.
- `pnpm test`: Vitest happy-dom; `pnpm test:ci` adds coverage; `pnpm test:watch`/`test:ui` for local loops.

## Coding Style & Naming

- TypeScript everywhere; aliases via `@` to repo root.
- Components, hooks: PascalCase files; utility modules: camelCase.
- Prefer server components; mark client components explicitly.
- Styling: Tailwind CSS v4; keep class lists small; factor repeated patterns into components.
- Formatting enforced by Prettier; 2-space indent; no unused exports (ESLint).

## Testing Guidelines

- Framework: Vitest + Testing Library + happy-dom.
- File pattern: `**/*.{test,spec}.{ts,tsx}` near source or under `tests/`.
- Coverage thresholds 60% lines/branches/functions/statements; see `vitest.config.ts`.
- Mock external calls (Clerk, Convex) at module boundary; avoid reaching network.

## Commit & PR Guidelines

- Conventional commits enforced by commitlint (`feat:`, `fix:`, `chore:`, etc.).
- Lefthook pre-commit auto-runs `eslint --fix` + `prettier --write`; let it stage fixes.
- Pre-push runs typecheck + `test:ci` + `build:check`; keep hooks green before PR.
- PRs: concise description, linked issue/card, screenshots for UI changes, list risky areas or TODO debt.

## Security & Config

- Copy `.env.example` → `.env.local`; fill Convex and Clerk keys; never commit secrets.
- Sentry configs in `sentry.*.config.ts`; keep DSN in env vars.
- Use `pnpm` only (`preinstall` enforces); Node ≥18.
