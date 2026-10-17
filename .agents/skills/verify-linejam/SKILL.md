---
name: verify-linejam
description: Run source-bound account-free guest, nine-round poem, and sharing/privacy walks on Linejam's isolated Next.js and Convex stack, then inspect the story-walk receipt.
---

# Verify Linejam

Use this skill for a PR-relevant story walk or the owned nightly full walk. [The feature map](../../../features/README.md) links the live stories to implementation. The [local runtime guide](../../../docs/local-development.md) owns Docker/port isolation, source synchronization, and limitations; the hosted `merge-gate` remains a separate required check. Browser work is on Mirrodin in the card workspace, never the chief or live desktop. No provider keys, Clerk account, production database, or remote Convex project is required for isolated guest play.

## Launch

On the isolated Linux/amd64 runner or an authorized project VM, install Node 22+ and ensure a local Docker daemon and Buildx are available, then run `bash .exe/setup.sh`. Setup installs Docker Compose 5.5.1 to a user plugin path after checking its published digest if the pinned version is missing; it does not install or start Docker. Run `qa/walk --stories "US-001 US-002"` for selected stories, or `qa/walk --all` for the full walk used by CI and nightly. The runner owns a fresh project-scoped local Next.js/Convex stack and a bounded browser journey, then tears down only its own containers/network. Never point it at a shared, preview, or production backend.

## Doctor

If setup fails, resolve missing Linux Docker/Node prerequisites through the host's normal owner; never change socket permissions or select a remote daemon. The isolated `scripts/local/cli.mjs` verifies app/backend readiness and matching source snapshots; a health response by itself is not story proof. Check `SPEC.md` and the expected story IDs before a run. `qa/walk --help` reports the selection syntax.

## Drive

The walk uses separate browser sessions for host, guest, and spectator. Check the actual rendered create/join and refresh continuity (US-001); the word/visibility contract, reconnect, nine accepted rounds and complete reveal (US-002); and private archive, spectator denial, explicit public-link activation and revocation (US-003). Existing local QA and browser tests are complementary, not a substitute for observing the numbered criteria in the same run. No skipped, inferred, or unrelated test is a passing story.

## Evidence

Judge the experience as family and friends arriving at a party, not engineers
who already know the rules. Use two independent people/contexts: one creates,
one joins from the displayed code. On desktop and a 390px touch viewport,
follow the visible writing prompts through reveal and find the next-game and
sharing actions without reading source. Use the map's Guest party, Poem and
Keep and share entries for routes. Inspect light/dark captures for comfortable
typing, visible submission state, legible poems and discoverable next actions.
Record where either person waited, guessed or lost their place. Emulation is
not a physical-phone test; public sharing stays inside the isolated stack.

Read `target/walk/walk-receipt.json`: it binds the run to exact HEAD and tree, enumerates the numbered criteria actually observed, and hashes sanitized artifacts. CI and nightly invoke `qa/walk --all` directly. The runner validates clean source, synchronized runtime identity, and observed criteria, and exits nonzero on walk or cleanup failure. A passing walk is not hosted Clerk, production, physical phone, or provider-outage proof; name such gaps rather than promoting fixture evidence.

## Cleanup

For each change, run heavy work only on Mirrodin under the card workspace.
Inspect actual screenshots/video, retain command/exit and candidate/serving
identity separately, and attach approved media/transcript to card top-level
`artifacts` and PR How to review. Keep this same feature map for fitness.

The walk always runs the owned local `down` for its project; after a failure, inspect the owned `.qa/local/` private files in place before further cleanup. Raw logs/traces can contain guest credentials, poem text, and room codes: do not upload them or add them to a public PR. Only `target/walk/` is a sanitized portable artifact, and it is ignored by Git. Never reset a state volume you do not own. The parent operator owns VM/worktree teardown, if any.
