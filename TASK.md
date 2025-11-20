# Operational Reliability & Safety PRD (2025-11-20)

1. **Executive Summary**

- Problem: Secrets can slip into git; CI burns minutes running serially; no /api/health for uptime probes. Current hooks fast but lack secret guard; prior TASK note about pre-commit typecheck is stale (already removed).
- Solution: Add gitleaks to pre-commit + CI fallback; split CI into parallel lint/format/typecheck feeding test+build; expose zero-dependency health endpoint returning JSON.
- User value: Faster signal for devs, prevents secret leaks, enables external monitors; production incidents caught sooner.
- Success metrics: (a) Secrets commit blocked locally with clear message; (b) CI wall-clock time cut ≥40% vs baseline (~>10 min → ≤6 min); (c) /api/health returns 200 within 150ms p95 and used by monitor.

2. **User Context & Outcomes**

- Personas: engineers (fast feedback), SRE/ops (monitoring), players (uptime), security steward.
- Outcomes: Commits safe by default; CI feedback before context-switch; monitors detect outages without user reports.

3. **Requirements**

- Functional
  - Pre-commit runs `gitleaks protect --staged --redact`; blocks commit on findings; message links to suppression doc.
  - CI backup scan: gitleaks job fails build if secrets detected in diff; redacts output.
  - CI graph: jobs `lint`, `format:check`, `typecheck` run in parallel; `test+build` waits on them; codecov still uploads coverage.
  - Health route `GET /api/health` (App Router): returns JSON `{ status: 'ok', timestamp, env }`; no auth; cache-control `no-store`.
- Non-functional
  - Hooks budget: pre-commit p95 <5s on laptop (no network); pre-push may be heavier (typecheck/test/build); CI/CD can remain exhaustive (“battery”).
  - gitleaks rules: include common keys in `.env.example` (Clerk, Convex, Sentry) plus generic JWT/API key regex; allow `.gitleaks.toml` for custom allowlist.
  - Health route runtime <100ms server-side; zero external calls; stable under 50 rps.
  - Backward compatibility: does not slow `pnpm dev`; CI uses existing pnpm cache.
- Infrastructure requirements
  - Quality gates: keep Lefthook; document gitleaks install (`brew install gitleaks`); pre-push remains typecheck/test/build.
  - Observability: wire health route errors to `logger` and `Sentry.captureException` behind feature flag; redact request headers.
  - Design consistency: no UI changes; follow existing TypeScript + Tailwind conventions for any helper.
  - Security: no env dumping; health payload excludes secrets; CI secrets pulled from GitHub Actions secrets.

4. **Architecture Decision**

- Chosen: Local gitleaks + CI gitleaks + parallelized CI + Node runtime health route. Rationale: highest user value with minimal plumbing; leverages existing Lefthook and GitHub Actions; keeps module boundaries simple (hooks, ci, app/api/health).
- Alternatives (scores weighted: value 40, simplicity 30, explicitness 20, risk 10)
  | Option | Value | Simplicity | Explicitness | Risk | Weighted |
  | --- | --- | --- | --- | --- | --- |
  | A) Selected: Local+CI gitleaks, parallel CI, /api/health | 9 | 7 | 8 | 8 | 8.1 |
  | B) CI-only gitleaks, keep sequential CI, add Vercel uptime check | 7 | 6 | 7 | 6 | 6.6 |
  | C) Rely on GitHub secret scanning only; no health; add CI cache | 5 | 8 | 5 | 4 | 5.8 |
  - Rejection reasons: B leaves devs blind until CI; C leaves monitoring + secrets gaps and mixes special/general handling.

5. **Data & API Contracts**

- `/api/health` (App Router route handler)
  - Method: GET
  - Response 200 JSON: `{ status: 'ok', timestamp: ISO8601, env: 'development' | 'preview' | 'production' }`
  - Headers: `Cache-Control: no-store`; `Content-Type: application/json`.
  - Failure: 500 with `{ status: 'error' }`; logged + captured to Sentry (if enabled).
- CI artifacts: coverage JSON still uploaded; gitleaks report optional artifact when failing.

6. **Implementation Phases**

- MVP (day 1): Add gitleaks pre-commit + docs; add `/api/health` route; add basic gitleaks job to CI; split CI jobs parallel and gate test+build.
- Hardening (day 2-3): Tune `.gitleaks.toml` rules; add pnpm cache/matrix reuse; add CI `--since` or `--incremental` flags where safe.
- Future: Extend health to ping Convex readiness; add UptimeRobot integration + status badge in README.

7. **Testing & Observability**

- Tests: unit test for health route handler (returns status ok, cache-control, timestamp ISO); snapshot gitleaks config minimal? (optional). Ensure CI workflow YAML lint via `act` optional.
- Observability: log health errors via `logger.error`; wrap with Sentry capture guard; ensure source maps uploaded already by build pipeline (unchanged).
- Performance monitoring: watch CI duration in GitHub UI; add workflow timing annotation.
- Analytics: no PII; health route excluded from analytics.

8. **Risks & Mitigations**

- False positives from gitleaks → Mitigate with `.gitleaks.toml` allowlist and redacted output; owner: security steward; likelihood M; impact M.
- Dev friction (missing gitleaks install) → Add hook failure help text + README note; owner: dev lead; likelihood M; impact M.
- CI time not dropping as expected → Add caching for pnpm + coverage upload; measure baseline before/after; owner: infra; likelihood L; impact M.
- Health route abused for probing → Keep minimal payload, rate-limit via Vercel defaults, no dynamic data; owner: infra; likelihood L; impact L.

9. **Open Questions / Assumptions**

- Open questions resolved:
  - Health remains simple/static (no Convex probe).
  - UptimeRobot is the chosen monitor.
  - Commit SHA omitted from health payload.
  - No Windows install steps needed.
  - Pre-commit stays ultra-snappy; heavier checks live in pre-push/CI.
