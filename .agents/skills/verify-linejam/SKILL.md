---
name: verify-linejam
description: Run source-bound account-free guest, nine-round poem, and sharing/privacy walks on Linejam's isolated Next.js and Convex stack, then inspect the foundation receipt.
---

# Verify Linejam

Use this skill for a PR-relevant story walk or the owned nightly full walk. [The feature map](../../../features/README.md) links the live stories to implementation. The [local runtime guide](../../../docs/local-development.md) owns Docker/port isolation, source synchronization, and limitations; the hosted `merge-gate` remains a separate required check. Browser work is on a GitHub runner or a commissioned project VM, never the workstation. No provider keys, Clerk account, production database, or remote Convex project is required for isolated guest play.

## Launch

On the isolated Linux/amd64 runner or an authorized project VM, install Node 22+ and ensure a local Docker daemon and Buildx are available, then run `bash .exe/setup.sh`. Setup installs Docker Compose 5.5.1 to a user plugin path after checking its published digest if the pinned version is missing; it does not install or start Docker. Run `qa/walk --stories "US-001 US-002"` for selected affected stories, or `qa/walk --all` for the nightly full walk. The runner owns a fresh project-scoped local Next.js/Convex stack and a bounded browser journey, then tears down only its own containers/network. Never point it at a shared, preview, or production backend.

## Doctor

If setup fails, install missing Linux Docker/Node prerequisites through the host's normal owner, or resolve an existing unsupported user Compose plugin deliberately; never change socket permissions or select a remote daemon. The isolated `scripts/local/cli.mjs` verifies app/backend readiness and matching source snapshots; a health response by itself is not story proof. Check `USER_STORIES.md` and the expected story IDs before a run. `qa/walk --help` reports the selection syntax.

## Drive

The walk uses separate browser sessions for host, guest, and spectator. Check the actual rendered create/join and refresh continuity (US-001); the word/visibility contract, reconnect, nine accepted rounds and complete reveal (US-002); and private archive, spectator denial, explicit public-link activation and revocation (US-003). Existing local QA and browser tests are complementary, not a substitute for observing the numbered criteria in the same run. No skipped, inferred, or unrelated test is a passing story.

## Evidence

Read `target/walk/walk-receipt.json`: it binds the run to exact HEAD and tree, enumerates the numbered criteria actually observed, and hashes sanitized artifacts. In CI, the pinned checker runs from `$RUNNER_TEMP/foundation`, never from the checkout: `foundation-check check --base "$BASE_SHA" --repo "$GITHUB_WORKSPACE"`, then `affected --base "$BASE_SHA"`, the walk, and `receipt target/walk/walk-receipt.json --base "$BASE_SHA"`. Nightly runs `check`, `qa/walk --all`, and `receipt target/walk/walk-receipt.json --all`. A passing checker receipt is not hosted Clerk, production, physical phone, or provider-outage proof; name such gaps rather than promoting fixture evidence.

## Cleanup

The walk always runs the owned local `down` for its project; after a failure, inspect the owned `.qa/local/` private files in place before further cleanup. Raw logs/traces can contain guest credentials, poem text, and room codes: do not upload them or add them to a public PR. Only `target/walk/` is a sanitized portable artifact, and it is ignored by Git. Never reset a state volume you do not own. The parent operator owns VM/worktree teardown, if any.
