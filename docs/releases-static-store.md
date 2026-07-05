# Static Release Store (`content/releases/`)

`app/releases/page.tsx` reads `content/releases/manifest.json` + one
`content/releases/vX.Y.Z/{changelog.json,notes.md}` per version via
`lib/releases/loader.ts`. This is the **only** store the page reads.

## The split-brain it replaces (linejam-915)

Before this fix, `content/releases/` was written once (v0.1.0, January 2026)
and never again — meanwhile Landmark's release workflow kept a second store,
`docs/releases/feed.xml` (RSS), current through every release. The page
showed v0.1.0 while the app itself was on v1.15.1. Two stores, one dead,
nothing keeping them in sync.

## The fix: one writer, one source

`.github/workflows/release.yml` runs
`scripts/release/write-release-from-git.mjs` immediately after Landmark tags
a release (`if: steps.landmark.outputs.released == 'true'`), then commits
`content/releases/` back to master. It:

1. Derives the technical `changes` array **deterministically** from git
   history between the previous tag and the new one
   (`scripts/release/conventional-commits.mjs` — parses Conventional
   Commits, drops `chore(release)`/`chore(feed)` automation noise, extracts
   PR numbers and `BREAKING CHANGE`/`!` markers). No LLM in this path.
2. Writes Landmark's already-synthesized `release-notes` output as
   `notes.md` prose. This reuses the synthesis pipeline already producing
   every GH Release body and RSS entry in this repo today — not a new trust
   surface. (Landmark's synthesis fabrication risk, caught 2026-07-04 in a
   sibling repo and tracked as `landmark-907`, only affects prose quality;
   the technical `changes` array this page's collapsible detail relies on
   never touches an LLM.)
3. Regenerates `manifest.json` from the version directories actually
   present on disk (`scripts/release/static-release-store.mjs`), so the
   manifest can never itself drift from the content it indexes.

## Backfill

`scripts/release/backfill-static-releases.mjs` walked every `v1.*` git tag
(21 versions, `v1.0.0`..`v1.15.1`) and wrote each one's deterministic
`changelog.json` the same way. It does not fabricate `notes.md` prose for
historical versions — `lib/releases/loader.ts` already tolerates a missing
`notes.md` (empty `productNotes`, technical details still render). Re-running
it is safe and idempotent; it only reads git history and regenerates output.

## The gate

`tests/scripts/release-manifest-version.test.ts` runs in the normal test
suite (every PR, every push) and fails if `manifest.json`'s `latest` does
not equal `package.json`'s `version`, if the latest version isn't listed
first, or if any listed version is missing its `changelog.json`. This is
what makes drift structurally impossible to reintroduce silently: the build
goes red before a release ships, not eight months after.
