## Planning Report

**Spec**: Operational Reliability & Safety — Design (2025-11-20)  
**Tasks Generated**: 7  
**Total Estimate**: 5h 20m  
**Critical Path**: 3h 35m (Tasks 1 → 2 → 4 → 5 → 6)

### Task Summary

| Phase   | Tasks | Estimate | Dependencies |
| ------- | ----- | -------- | ------------ |
| Setup   | 1     | 45m      | None         |
| Hooks   | 2     | 30m      | Setup        |
| Docs    | 3     | 20m      | Hooks        |
| CI      | 4     | 1h 30m   | Setup        |
| API     | 5-6   | 1h 15m   | None/CI      |
| Quality | 7     | —        | All          |

### Tasks (atomic, executable)

- [x] **Task 1: Add base gitleaks config**
  - Files: `.gitleaks.toml` (new)
  - Goal: Define repo-specific secret rules (Clerk, Convex, Sentry) with redaction + allowlist support.
  - Approach: (1) Start from gitleaks default config; (2) Add regexes for keys in `.env.example`; (3) Add allowlist section with comments; (4) Run `gitleaks detect --no-banner --redact --source .` to ensure clean baseline.
  - Success Criteria: Clean run on current repo; intentional test secret string is detected and redacted.
  - Tests: Manual gitleaks run (above).
  - Estimate: 45m

- [x] **Task 2: Wire gitleaks into Lefthook pre-commit**
  - Files: `lefthook.yml`
  - Goal: Block commits with secrets while keeping pre-commit <5s.
  - Approach: (1) Add `secrets` command under `pre-commit` running `gitleaks protect --staged --redact --no-banner`; (2) Add helpful failure message (install link, allowlist tip); (3) Verify ordering with lint/format (parallel true).
  - Success Criteria: Commit with staged fake secret fails with clear message; commit without secrets passes; hook runtime <5s on typical staged set.
  - Tests: Manual commit attempt with/without seeded secret file.
  - Estimate: 30m
  - depends: Task 1

- [x] **Task 3: Document secret scanning for devs**
  - Files: `README.md` (new section) or `docs/secrets.md` (new)
  - Goal: Reduce friction installing/using gitleaks locally.
  - Approach: (1) Add install command `brew install gitleaks`; (2) Document hook behavior and suppressing false positives via `.gitleaks.toml` allowlist; (3) Include troubleshooting for missing binary.
  - Success Criteria: Documentation explains install + suppression in ≤10 lines; references match hook command.
  - Tests: Spellcheck/skim; no CI impact.
  - Estimate: 20m
  - depends: Task 2

- [x] **Task 4: Parallelize CI and add gitleaks job**
  - Files: `.github/workflows/ci.yml`
  - Goal: Run lint/format/typecheck/gitleaks in parallel; gate `test+build` on their completion; keep coverage upload.
  - Approach: (1) Split existing `quality-checks` into separate jobs `lint`, `format`, `typecheck`, `gitleaks` with shared setup; (2) Add `test-build` job needing all four; (3) Keep codecov upload after tests; (4) Ensure pnpm caching remains.
  - Success Criteria: Workflow graph shows four parallel jobs and downstream test-build; pushing a fake secret fails gitleaks job; successful run finishes ≤6min target (post-merge measurement).
  - Tests: Dry-run YAML lint via `act` optional; CI run on PR.
  - Estimate: 1h 30m
  - depends: Task 1

- [x] **Task 5: Implement `/api/health` route**
  - Files: `app/api/health/route.ts` (new)
  - Goal: Minimal healthcheck returning `{ status:'ok', timestamp, env }` with no-store caching and no external deps.
  - Approach: (1) Create GET handler per DESIGN pseudocode; (2) On error, log via `logger.error` and best-effort `Sentry.captureException`; (3) Ensure export works in App Router.
  - Success Criteria: Hitting route in dev returns 200 with fields; response has `Cache-Control: no-store`; no errors when Convex unavailable.
  - Tests: Covered in Task 6.
  - Estimate: 30m

- [x] **Task 6: Test health route**
  - Files: `tests/app/api/health.test.ts` (new)
  - Goal: Verify success and error paths of health handler.
  - Approach: (1) Import GET, assert 200 JSON payload shape + cache-control; (2) Mock Date to throw to force error path, assert 500 payload and logger/Sentry stubs invoked; (3) Add to `pnpm test:ci`.
  - Success Criteria: Tests pass locally and in CI; coverage includes success + failure branches.
  - Tests: `pnpm test:ci` (subset ok).
  - Estimate: 45m
  - depends: Task 5

- [x] **Task 7: Post-change quality pass**
  - Files: n/a (commands)
  - Goal: Ensure repo gates clean after changes.
  - Approach: Run `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test:ci`, `pnpm build:check`; run `gitleaks detect` once for sanity.
  - Success Criteria: All commands pass.
  - Estimate: 20m
  - depends: Tasks 1-6 (implicit)

### Critical Path

Task 1 → Task 2 → Task 4 → Task 5 → Task 6 (3h 35m). Other tasks can run in parallel where dependencies allow.

### Risks

- gitleaks false positives blocking commits — mitigate with allowlist + docs (Task 3).
- CI time reduction not hitting target — monitor after refactor; adjust caching if needed.
- Health route test harness may need Next routing helpers — if so, add minimal helper or mock Response.

### Out of Scope / Not Doing

- Convex connectivity check in health (intentionally excluded).
- Windows/Linux install guides for gitleaks.
- UptimeRobot configuration itself (ops follow-up post-merge).
