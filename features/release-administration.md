# Release administration

Stories: US-004
Source: .github/workflows/release.yml, .env.pass, scripts/releases/**, scripts/generate-releases.ts, lib/releases/**, app/releases/page.tsx, site/changelog.html, docs/releases/feed.xml, qa/release-walk-fixture.mjs, qa/walk-specs.mjs, tests/scripts/release-prepare.test.ts, tests/scripts/site-changelog.test.ts, tests/lib/releases/catalog.test.ts, docs/deployment.md

## Sub-features

A release candidate is prepared from the current protected source, reviewed in a pull request, and published only with matching source and version. If the notes provider fails after supplying reviewable evidence, preparation removes stale editorial notes and builds explicit technical-only history; malformed or ungrounded evidence still fails closed. The public page, static changelog, and feed distinguish unavailable generated notes from reviewed notes.

## How to get to it (user POV)

A maintainer inspects the Release run, its candidate pull request and full CI checks, and the release postmortem. A reader opens `/releases`, `site/changelog.html`, or `docs/releases/feed.xml` to read the history and its notes status. These are release-administration and publication boundaries, not evidence that the player application was deployed.

## Driving it

`qa/walk --stories "US-004"` exercises a credential-free controlled provider failure, the candidate's source and publication contract, and disposable rendered public surfaces. The dedicated production key is bound separately; a local fixture does not certify provider allowance, an authorized merge, hosted publication, or the external alert-classifier rollout.

## Gotchas

Never reuse a shared harness key for release-note inference. A valid technical-only candidate is not a published release. The [provider-coupling postmortem](../docs/postmortems/2026-09-28-release-provider-coupling.md) tracks the distinct release, player-deployment, and alert-classification receipts; the classifier fix is owned by [hermes-config draft PR #104](https://github.com/misty-step/hermes-config/pull/104).
