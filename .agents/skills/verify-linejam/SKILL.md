---
name: verify-linejam
description: Verify Linejam's built Worker and real guest journeys, inspect desktop/phone proof, and distinguish covered behavior from remaining story gaps.
---

# Verify Linejam

Use [the shared feature map](../../../features/README.md) for SPEC intent and
navigation. [README: Verify a candidate](../../../README.md#verify-a-candidate)
owns the current built Worker/SQLite Durable Object verification lifecycle and
runtime pins. Run it on Mirrodin in the card workspace, not the chief or live
desktop. It needs no production credentials, Clerk account or remote backend.

## Launch

In a clean candidate checkout, follow the README's frozen dependency, Rust and
browser prerequisites, then run `pnpm check --mode full`. It builds the actual
Worker and owns isolated workerd/SQLite, guest browser and recovery checks.
`pnpm check --mode fast` is source/unit verification, not a rendered journey.

The [local runtime guide](../../../docs/local-development.md) owns the separate
Next/Convex Docker stack for interactive or legacy `qa/walk` work. A Docker
bridge/startup failure is not a prerequisite for the native Worker command.

## Doctor

Check the README's pinned runtime/browser prerequisites and clean source before
driving. The native checks own their readiness probes and refuse live
credentials/dotenv files. Preserve a failure before correcting a run-owned
environment problem; do not repair shared daemons or adopt another stack.
Check SPEC and the selected stories; health alone is not acceptance.

## Drive

Inspect the native guest/party controls through separate player contexts for
the map's Guest party and Poem entries. Follow Keep and share and Release
administration for their separate checkpoints. Visible Share/Revoke buttons
do not prove public-link creation/read/revocation; a rendered Changelog does
not prove the controlled release-note failure. Report those paths unverified
until actually driven. Never infer a whole-story pass from related tests.

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

Retain native source-bound command output and inspected media from
`.qa/worker/qa/evidence` and `.qa/worker/qa/entry-ui`, as owned by the README.
For an actual legacy `qa/walk` run, inspect `target/walk/walk-receipt.json`
instead; a failed legacy receipt remains failed even when native checks pass.
Neither isolated path proves hosted Clerk, deployment, physical-phone use or
unexercised sharing/release behavior.

## Cleanup

For each change, run heavy work only on Mirrodin under the card workspace.
Inspect actual screenshots/video, retain command/exit and candidate/serving
identity separately, and attach approved media/transcript to card top-level
`artifacts` and PR How to review. Keep this same feature map for fitness.

Confirm the native command has stopped its owned workerd/browser processes.
For the separate Docker lifecycle, use its owned `down`/status controls. Retain
approved evidence before removing owned temporary state. Raw logs/traces may
contain guest credentials, poems and room codes: never publish them or reset
another owner's volume. A screenshot directory is not a blanket privacy approval.
