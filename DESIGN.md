# Operational Reliability & Safety — Design (2025-11-20)

## Architecture Overview

**Selected Approach**: Local+CI gitleaks, parallelized CI pipeline, minimal `/api/health` route.
**Rationale**: Highest value per complexity: prevents secret leaks at source, slashes CI wall time by parallelizing independent gates, gives UptimeRobot a stable probe. Fits current Next/Convex monorepo and Lefthook/Actions setup without new services.

**Core Modules**

- SecretScanHook — pre-commit secret scanning via gitleaks; fast failure path for devs.
- SecretScanCI — GitHub Actions job to enforce scanning server-side.
- CIParallelPipeline — split lint/format/typecheck in parallel; gate test+build.
- HealthRoute — App Router handler for `/api/health`; zero dependencies.
- Docs/Config — `.gitleaks.toml` + README snippet to keep install friction low.

**Data Flow**: Developer commit → SecretScanHook → (passes) push → CIParallelPipeline (lint|format|typecheck|gitleaks in parallel) → test+build → deploy; UptimeRobot → HealthRoute → JSON status.

**Key Decisions**

1. Use CLI gitleaks (not node package) to match industry baseline and speed; CLI redaction on by default.
2. Keep health route static (no Convex check) to ensure <100ms and avoid cascading outages.
3. CI uses matrix-free fan-out jobs (lint, format, typecheck, gitleaks) to minimize cache duplication and keep logs simple.
4. Pre-commit remains ultra-snappy: only eslint/prettier/gitleaks; heavy checks stay pre-push/CI (“battery”).
5. Observability: health errors go to `logger.error` and `Sentry.captureException` if enabled; normal 200s unlogged.

## Module: SecretScanHook

Responsibility: Block secret commits locally with minimal latency.

Public interface (via Lefthook `lefthook.yml`):

```
pre-commit.commands.secrets:
  run: gitleaks protect --staged --redact --no-banner || (echo "See docs/secrets.md for suppressing false positives"; exit 1)
```

Internal implementation notes

- Uses staged diff only (`--staged`) to keep runtime ~1-2s.
- Redacts findings (`--redact`) to avoid exposing secrets in console.
- No network access needed.
- If gitleaks missing, command should fail with actionable message; document `brew install gitleaks`.

Dependencies: gitleaks CLI available on dev machine.  
Used by: local developers via Lefthook pre-commit.

Error handling

- Missing binary → exit non-zero with install hint.
- False positive → developer adds allowlist entry in `.gitleaks.toml` (scoped regex or path).

Tests

- Manual: run `gitleaks detect --no-banner` on repo in CI (covered by SecretScanCI). No unit tests.

## Module: SecretScanCI

Responsibility: Enforce secret scanning in CI as backstop.

Interface (GitHub Actions job):

- Job name `gitleaks`.
- Steps: checkout, install gitleaks (official action or curl), run `gitleaks detect --verbose --redact --source . --log-level error`.
- Artifact: optional `gitleaks.sarif` upload for auditing (optional).

Dependencies: GitHub-hosted runners; repository contents.
Consumers: CI workflow `ci.yml`.

Error handling

- On findings → job fails; logs are redacted.
- On tool download failure → retry once; otherwise fail fast (keeps signal honest).

## Module: CIParallelPipeline

Responsibility: Reduce CI wall time; keep gates explicit.

Structure

- Jobs: `lint`, `format`, `typecheck`, `gitleaks` run in parallel.
- Job `test-build` depends on all four; runs `pnpm test:ci` then `pnpm build:check`.
- Shared setup steps per job: checkout → pnpm setup → node setup (v22) → `pnpm install --frozen-lockfile`.
- Coverage upload remains after tests in `test-build`.

Error handling

- Any upstream job fail → `test-build` skipped.
- Continue-on-error only for coverage upload.

Performance budget

- Goal: cut CI from ~10min to ≤6min.
- Caching: Keep pnpm cache; no matrix to avoid cache thrash.

## Module: HealthRoute

Responsibility: Fast uptime probe for UptimeRobot.

Interface (`app/api/health/route.ts`):

```typescript
export async function GET() {
  try {
    return Response.json(
      {
        status: 'ok',
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV ?? 'development',
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    const { logger } = await import('@/lib/logger');
    await import('@sentry/nextjs')
      .then((Sentry) => Sentry.captureException?.(error))
      .catch(() => undefined);
    logger.error({ error }, 'Healthcheck failed');
    return Response.json(
      { status: 'error' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
```

Notes

- No Convex call; avoids cascading failures.
- No auth; payload excludes commit SHA.
- Must be tree-shake-safe for edge/node; minimal deps to keep cold-start small.

Tests

- Vitest route test: asserts 200, `status: ok`, ISO timestamp, `Cache-Control: no-store`.
- Error path test by mocking `Date` throw.

## Module: Docs/Config

Responsibility: Keep friction low; make rules explicit.

Artifacts

- `.gitleaks.toml`: base rules for Convex/Clerk/Sentry keys; allowlist section.
- README snippet or `docs/secrets.md`: install instructions, suppressing false positives, sample command.

## Core Algorithms (pseudocode)

**Pre-commit hook execution**

1. Lefthook gathers staged files.
2. Run `gitleaks protect --staged --redact --no-banner`.
3. If exit 0 → continue; else print help URL and abort commit.

**CI pipeline dependency graph**

```
lint   \
format  \
typecheck --\
gitleaks   |--> test-build --> coverage upload
```

Each upstream job: setup → install → run single command.

**Health GET**

1. try { build payload with status ok, iso timestamp, env }
2. return 200 JSON + Cache-Control no-store
3. catch err: capture via Sentry (best-effort), log via logger, return 500 JSON

## File Organization

- `lefthook.yml` — add `secrets` command to pre-commit; keep existing lint/format; pre-push unchanged.
- `.gitleaks.toml` — new config at repo root.
- `.github/workflows/ci.yml` — refactor into parallel jobs + gitleaks job + test-build aggregate.
- `app/api/health/route.ts` — new App Router handler.
- `tests/app/api/health.test.ts` (or `tests/health/route.test.ts`) — Vitest.
- `README.md` or `docs/secrets.md` — install instructions + false-positive handling.

## Integration Points

- External: gitleaks CLI (local + CI); UptimeRobot hits `/api/health`.
- Env vars: use `NODE_ENV` only in health; no secrets needed.
- Observability: uses existing `lib/logger` + Sentry configs; no new envs.
- CI secrets: SENTRY token for potential release steps already present; gitleaks needs none.

## State Management

- Health route stateless.
- No new client/server state.
- Caching disabled via `Cache-Control: no-store`.

## Error Handling Strategy

- Hooks: non-zero exit blocks commit; message includes suppress instructions.
- CI: job failure fails pipeline; no retries beyond default.
- Health: 500 on internal error; logged + Sentry (best effort).
- Redaction: gitleaks uses `--redact`; logger redact list already includes secrets.

## Testing Strategy

- Unit: health route success + failure.
- Integration (CI): pipeline itself exercises gitleaks.
- Manual: simulate secret string in staged file; ensure pre-commit blocks.
- Commands: `pnpm test:ci` (includes new tests), optional `gitleaks detect --no-banner`.
- Quality gates: pre-commit (lint, format, secrets), pre-push (typecheck, test, build), CI (parallel lint/format/typecheck/gitleaks → test-build).

## Performance & Security Notes

- Latency targets: health p95 <100ms (no external calls).
- CI budget: ≤6min wall time target after parallelization.
- Threats mitigated: secret leakage (local+CI), health info exposure kept minimal (no SHA, no infra data).
- Observability: add log line only on error to avoid noise; Sentry capture for failure path only.
- Alerting: configure UptimeRobot to ping `/api/health` every 60s with 2-failure alert policy (out of scope to implement, but endpoint ready).

## Alternative Architectures Considered

| Option                                                     | Pros                                   | Cons                                          | Verdict  | Revisit trigger                          |
| ---------------------------------------------------------- | -------------------------------------- | --------------------------------------------- | -------- | ---------------------------------------- |
| A) Selected: Local+CI gitleaks, parallel CI, static health | High value, low complexity, fast hooks | Requires dev install of gitleaks              | Chosen   | If gitleaks proves too noisy/slow        |
| B) CI-only gitleaks + sequential CI                        | No local setup                         | Devs find leaks late; slower CI               | Rejected | If local install friction becomes severe |
| C) GitHub secret scanning only + Vercel health             | Zero setup                             | Misses local catches; health tied to platform | Rejected | If gitleaks banned or costed             |

## Open Questions / Assumptions

- Assume devs install gitleaks via Homebrew; Windows/Linux instructions omitted by choice.
- Assume UptimeRobot will be configured post-merge.
- Assume keeping commit SHA out of health is acceptable permanently.
