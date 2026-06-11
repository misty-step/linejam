# Govern Evidence And Smoke Artifacts

Priority: P1
Status: ready
Estimate: L

## Goal

Make visual, smoke, and agentic QA evidence trustworthy enough to guide merge and incident decisions instead of remaining advisory logs that can pass with runtime breakage.

## Oracle

- [ ] `pnpm vitest run tests/scripts/canary-trigger-smoke.test.ts tests/qa/agentic.test.ts`
- [ ] New Vitest coverage for `scripts/evidence/guest-flow.mjs` proves runtime errors and artifact packaging failures fail or require an explicit waiver.
- [ ] Runtime console/page/request errors in `pnpm evidence:guest-flow` produce a failing result unless explicitly waived in a typed allowlist.
- [ ] Artifact completeness is validated: manifest, summary, screenshots, video or documented video waiver, and server log are present before a run is marked pass.
- [ ] Preview and production smoke workflows upload durable Playwright/stdout/stderr artifacts on both success and failure.
- [ ] Merge policy is explicit: either `qa-evidence` participates in `merge-gate`, or PR-ready criteria require a linked evidence artifact with its failure semantics documented.
- [ ] Agentic QA after smoke has a documented policy for preview and production: always on, sampled, or intentionally manual, with artifact paths in the smoke summary.

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
