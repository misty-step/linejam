# Release administration

Stories: US-004
Source: .github/workflows/release.yml, .env.pass, scripts/releases/**, scripts/generate-releases.ts, lib/releases/**, app/releases/page.tsx, site/changelog.html, docs/releases/feed.xml, qa/release-walk-fixture.mjs, qa/walk-specs.mjs, tests/scripts/release-prepare.test.ts, tests/scripts/site-changelog.test.ts, tests/lib/releases/catalog.test.ts, docs/deployment.md

Acceptance: [SPEC.md — US-004](../SPEC.md#us-004-live-prepare-a-reviewed-release-when-generated-notes-fail).

## Driving it

`qa/walk --stories "US-004"` exercises a credential-free controlled provider failure, the candidate's source and publication contract, and disposable rendered public surfaces. The dedicated production key is bound separately; a local fixture does not certify provider allowance, an authorized merge, hosted publication, or the external alert-classifier rollout.

## Gotchas

Never reuse a shared harness key for release-note inference. A valid technical-only candidate is not a published release. The [provider-coupling postmortem](../docs/postmortems/2026-09-28-release-provider-coupling.md) tracks the distinct release, player-deployment, and alert-classification receipts; the classifier fix is owned by [hermes-config draft PR #104](https://github.com/misty-step/hermes-config/pull/104).
