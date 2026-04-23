# Establish Stagehand Agentic QA Harness

Priority: high
Status: done
Estimate: L

## Goal

Add a local-first agentic QA lane that runs named browser missions against Linejam, emits a stable artifact bundle, and grades the run with a separate critic so exploratory QA finds regressions that deterministic Playwright smoke does not.

## Non-Goals

- Replace Vitest, Playwright, or Dagger as the authoritative CI contract
- Auto-fix bugs or auto-deploy code
- Let an LLM critic block merges in the first release
- Expand the responder into a full autonomous incident commander
- Adopt a more autonomous browser stack than needed for a first-party app

## Constraints / Invariants

- Dagger plus deterministic Playwright remain the source of truth for pass/fail CI
- The executor and critic must stay separate; no self-grading
- Every run must start from a named mission and write a machine-readable artifact bundle
- Missions must work against `local` first, then `preview`; production escalation is follow-on work
- Authenticated missions must reuse the existing Clerk smoke posture and fail closed on live-key drift
- Canary remains the primary incident sink; agentic QA augments Canary and Playwright instead of bypassing them

## Authority Order

tests > type system > code > docs > lore

## Notes

- Recommended stack: Stagehand for exploratory execution, Promptfoo for critic scoring, existing Playwright smoke for deterministic baseline
- Keep `agent-browser` and Dogfood as operator tools, not the core harness contract
- Defer Checkly or other hosted synthetics until the local and preview missions are stable

## Product Direction

### Approaches considered

1. **Stagehand executor + Promptfoo critic layered on Playwright**  
   Best fit. Preserves the current TypeScript/browser stack, keeps deterministic tests intact, and adds an exploratory lane with explicit artifacts and separate grading.

2. **Playwright-only expansion**  
   Low risk but misses the exploratory, fuzzy UX, and screenshot-driven QA goals that motivated this work.

3. **More autonomous browser agents first (`browser-use`, `Skyvern`, similar)**  
   Higher autonomy than needed for a first-party app. More operational drag and nondeterminism before we have a solid artifact and critic contract.

### Recommendation

Choose approach 1. Linejam already has a strong deterministic spine and a live Canary responder. The next missing module is an exploratory executor with stable evidence, not a new general-purpose browser platform.

## Technical Direction

### Recommended design

- Add a `qa/agentic/` module that owns:
  - mission definitions
  - artifact manifest schema
  - Stagehand runner
  - Promptfoo critic adapter
- Keep the execution surface thin:
  - Stagehand runs a mission against a supplied base URL
  - writes screenshots, trace links, transcript, console/network summaries, and a JSON manifest
  - hands the manifest to a separate critic
- Keep the critic deterministic where possible:
  - deterministic assertions first: final URL, visible copy, absence of generic error UI, artifact presence
  - model-graded rubric second: coherence, goal success, UX quality, unexpected friction
- Keep CI posture advisory first:
  - local/manual and preview runs produce reports
  - critic failures do not gate merge until false-positive rate is understood

### Repo Anchors

- `playwright.smoke.config.ts`
- `playwright.global.setup.ts`
- `tests/e2e/prod-smoke.spec.ts`
- `tests/e2e/support/clerk.ts`
- `scripts/canary/trigger-smoke.mjs`
- `scripts/canary/responder.mjs`
- `scripts/canary/events.mjs`
- `docs/testing.md`
- `docs/ops/canary-responder.md`

### Prior Art

- `tests/e2e/prod-smoke.spec.ts` already captures the two highest-value smoke missions: guest multiplayer and signed-in join
- `tests/e2e/support/clerk.ts` already encodes the live-vs-test Clerk safety posture
- `scripts/canary/trigger-smoke.mjs` already owns smoke escalation, env filtering, and auth guardrails
- `scripts/canary/responder.mjs` already gives us the thin incident loop shape we want to preserve

## Oracle

- [ ] `pnpm ci:dagger:all`
- [ ] `pnpm qa:agentic:local --mission guest-host-signed-in-join`
- [ ] `pnpm qa:agentic:local --mission signed-in-host-guest-join`
- [ ] `pnpm qa:agentic:preview --mission guest-host-signed-in-join --base-url https://<preview-url>`
- [ ] Each run writes `.qa/runs/<run-id>/manifest.json` plus screenshots and a critic summary
- [ ] The critic marks an intentionally injected generic join error as fail and a healthy join mission as pass
- [ ] `pnpm canary:responder` can be configured to attach the artifact bundle path or summary for follow-on investigation without replacing the existing deterministic smoke trigger

## Implementation Sequence

1. Add mission definitions and a versioned artifact manifest schema
2. Add the Stagehand runner for local and preview missions, reusing existing Clerk smoke helpers where auth is required
3. Add Promptfoo critic configs that grade artifact bundles against explicit rubrics and thresholds
4. Add a Dagger advisory lane for agentic QA so local execution is first-class without becoming merge-gating
5. Add responder handoff hooks so Canary incidents can attach agentic QA evidence after deterministic smoke, still behind an explicit flag

## Risk + Rollout

- Main risk: flaky or over-opinionated LLM grading creates noise
  - Mitigation: keep critic advisory-only at first and require deterministic assertions in every mission
- Main risk: exploratory harness drifts away from real auth and room-flow constraints
  - Mitigation: reuse existing Playwright auth helpers and room missions instead of inventing a separate auth path
- Rollout:
  1. local only
  2. preview/manual
  3. scheduled preview
  4. production post-deploy advisory

## What Was Built

- Added `qa/agentic/` mission, manifest, deterministic critic, and Promptfoo advisory config for the first two room-flow missions.
- Added `scripts/qa/agentic-runner.mjs` to run local/preview missions with Playwright contexts, Clerk auth guardrails, Stagehand page actions, screenshots, manifest output, and separate critic artifacts.
- Added `LINEJAM_SMOKE_RUNNER=agentic` so Canary follow-up can produce agentic QA evidence without changing the default deterministic smoke path.
- Added `pnpm ci:dagger:agentic-qa` and `pnpm ci:dagger:agentic-qa-preview` as explicit non-gating Dagger advisory lanes.

## Verification

- `pnpm test --run tests/scripts/agentic-qa.test.ts tests/scripts/canary-trigger-smoke.test.ts tests/scripts/canary-store.test.ts tests/scripts/dagger-call.test.ts`
- `pnpm qa:agentic:critic:fixtures`
- `pnpm typecheck`
- `pnpm format:check`
- `pnpm lint`
- `pnpm ci:dagger:agentic-qa`
