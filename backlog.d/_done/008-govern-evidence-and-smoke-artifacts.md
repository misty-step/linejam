# Govern Evidence And Smoke Artifacts

Priority: P1
Status: done
Estimate: L

## Goal

Make visual, smoke, and agentic QA evidence trustworthy enough to guide merge and incident decisions instead of remaining advisory logs that can pass with runtime breakage.

## Oracle

- [x] `pnpm vitest run tests/scripts/canary-trigger-smoke.test.ts tests/qa/agentic.test.ts`
- [x] New Vitest coverage for `scripts/evidence/guest-flow.mjs` proves runtime errors and artifact packaging failures fail or require an explicit waiver.
- [x] Runtime console/page/request errors in `pnpm evidence:guest-flow` produce a failing result unless explicitly waived in a typed allowlist.
- [x] Artifact completeness is validated: manifest, summary, screenshots, video or documented video waiver, and server log are present before a run is marked pass.
- [x] Preview and production smoke workflows upload durable Playwright/stdout/stderr artifacts on both success and failure.
- [x] Merge policy is explicit: either `qa-evidence` participates in `merge-gate`, or PR-ready criteria require a linked evidence artifact with its failure semantics documented.
- [x] Agentic QA after smoke has a documented policy for preview and production: always on, sampled, or intentionally manual, with artifact paths in the smoke summary.

## Children

1. Convert evidence runtime errors and packaging failures from `PASS_WITH_ERRORS` into fail-or-waive outcomes.
2. Persist preview/prod smoke artifacts from `.github/workflows/preview-smoke.yml` and `.github/workflows/prod-smoke.yml`.
3. Add an evidence quality check to the CI rollup or document why it remains outside `merge-gate`.
4. Decide and implement the `LINEJAM_AGENTIC_QA_AFTER_SMOKE` policy for pre-prod and prod.
5. Update `docs/testing.md` and `docs/ops/canary-responder.md` with the evidence decision tree.

## Notes

- The current CI workflow labels QA evidence advisory and keeps `merge-gate` dependent only on quality, build, and E2E mirror jobs.
- `scripts/evidence/guest-flow.mjs` can emit `PASS_WITH_ERRORS` for runtime errors without throwing when the core flow succeeds.
- Preview and production smoke workflows currently run `./scripts/ci/dagger-call.sh smoke` without artifact upload steps.

## Repo Anchors

- `.github/workflows/ci.yml`
- `.github/workflows/preview-smoke.yml`
- `.github/workflows/prod-smoke.yml`
- `scripts/evidence/guest-flow.mjs`
- `scripts/canary/trigger-smoke.mjs`
- `qa/agentic/`
- `docs/testing.md`
- `docs/ops/canary-responder.md`

## What Was Built

- Converted guest-flow evidence into fail-or-waive verdicts with typed, expiring runtime and artifact waivers recorded in the summary and manifest.
- Added artifact completeness checks for screenshots, packaged video, generated GIF, copied server log, and packaging failures before evidence can pass.
- Extended guest-flow runtime capture to include page errors, console errors, failed requests, and HTTP responses with status >= 400.
- Made `qa-evidence` part of the required `merge-gate` in CI.
- Reworked preview and production smoke workflows to run the Playwright smoke runner directly and upload stdout, stderr, `test-results/`, and `playwright-report/` artifacts on success or failure.
- Documented the evidence decision tree and the intentionally manual `LINEJAM_AGENTIC_QA_AFTER_SMOKE` policy for preview and production.

## Verification

- `pnpm vitest run tests/scripts/guest-flow-evidence.test.ts`
- `pnpm vitest run tests/scripts/canary-trigger-smoke.test.ts tests/qa/agentic.test.ts tests/scripts/guest-flow-evidence.test.ts`
- `pnpm format:check`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm ci:dagger:all-no-e2e`
- `pnpm ci:prepush`
- Fresh read-only critic blocked on missing GIF completeness validation; fixed with `collectFileArtifactErrors({ gifPath })` and a regression test, then reran `pnpm ci:prepush`.

## Workarounds

- Hosted preview and production smoke artifacts still depend on GitHub Actions artifact retention; the workflows set 14-day retention for the smoke logs and Playwright bundles.
