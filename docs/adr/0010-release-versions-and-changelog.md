# ADR-0010: Release Versions, Notes and `/changelog`

## Status

Accepted (2026-10-14)

## Context

The Misty Step [release convention](https://github.com/misty-step/harness/blob/59ea8e4a403469592f43d9bcf921988b4efec1a3/docs/release-convention.md)
(accepted 2026-10-14) is the one implementation convention for versions,
changelogs and release notes. This record holds only Linejam's local choices;
the convention's rules are not restated here.

On 2026-10-14 the newest published release was still v0.27.0 from 2026-08-01,
although master had 79 commits since then. The release history explains why:

- 2026-08-14/15: semantic-release's git plugin tried to push a release commit
  to protected `master` and was rejected (`GH006`). The workflow was disabled.
- 2026-09-08 to 09-25: the reviewed release-PR flow failed before preparing a
  candidate because paid note synthesis returned HTTP 401, and synthesis was
  mandatory.
- From 2026-09-26: release PR #521 held the 0.28.0 candidate. Every master push
  refreshed it, but nobody merged it. GitHub leaves `workflow_dispatch` check
  suites out of a PR's status rollup, so its passing exact-head CI never showed
  on the PR, which read as unstable.

## Decision

1. **Release unit.** One: the Linejam web application, versioned by
   `package.json`, reported by `/api/health` beside the full deployment SHA.
2. **Generator.** Landmark, pinned in `.github/workflows/release.yml`, decides
   the version through its semantic-release adapter. No second analyzer.
3. **Baseline.** When this record was adopted, `v0.27.0` (`70c68b7`,
   2026-08-01) was the authoritative baseline: 33 GitHub Releases and 35 tags,
   with the highest version also the newest. The pending 0.28.0 candidate was
   then published from it as the first immutable release, `v0.28.0`
   (`e3d35c6`). The v1.x entries in `CHANGELOG.md` are real history from before
   the recorded 2026-07-08 reset (v1.15.1 became v0.15.1). Their tags and
   releases were retired, so their compare links no longer resolve. They stay in
   date order and are never retagged or renumbered. Landmark versions an
   untagged history from 0.0.0, so preparation refuses when the previous
   release tag is missing.
4. **Pre-1.0 policy.** Landmark's documented pre-stable rules apply below 1.0.0:
   a breaking change bumps the minor version, and a feature, fix or performance
   change bumps the patch version. Promotion to 1.0.0 is a deliberate decision.
5. **Input.** Squash merges only, with the PR title as the commit title.
   `.github/workflows/pr-title.yml` rejects titles that are not Conventional
   Commits.
6. **Notes.** Landmark's balanced synthesis, with the dedicated release key, is
   optional enrichment. `model.policy: off` in `.landmark.yml` turns it off and
   needs no key. A release without public notes shows its status and its
   deterministic technical history, open, on `/changelog`, the site changelog,
   the feed and the GitHub Release.
7. **Release PR.** CI is dispatched for the exact head of `landmark/release`.
   The merging agent reads the head commit's check runs, not the PR badge,
   checks the version against the included commits and the notes for private
   data, then squash-merges promptly. A rerun for the same source keeps a
   matching open candidate from this repository, with valid or skipped notes,
   rather than synthesizing again.
8. **Publication.** The next green master CI publishes the tag and GitHub
   Release from the merged candidate, without a release commit. Immutable
   releases are enabled for the repository.
9. **Reachable notes.** `/changelog` renders the release catalog built into the
   deployed revision and is linked from the footer. `/releases` stays a
   rendered alias for existing links; `/releases.xml` is the feed.
10. **Deployment and failures.** Cloudflare Production deploys every green
    master commit whether or not it is released. A failed Release run is a
    failed GitHub workflow and goes through the existing incident intake; this
    repository adds no watcher.

## Consequences

- A feature merged after 0.28.0 is expected to release as 0.28.1.
- Branch protection does not require status checks, because GitHub may not
  count dispatched check runs toward a PR. The merging agent's exact-head check
  stands in for it.
- Paid notes can be switched off with one reviewed line, with no key and no
  provider request, and releases keep useful notes either way.

## Alternatives Considered

- **release-please.** Rejected: the convention keeps a working generator and
  forbids a second one.
- **Retagging the v1.x line.** Rejected: published history is never rewritten.
- **Turning synthesis off now.** Deferred: the notes read better for players
  than commit titles, though v0.28.0 carried one speed claim its PRs do not
  support. The deterministic fallback already stands on its own.
