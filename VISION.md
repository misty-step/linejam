# Linejam Vision

Status: Canonical root vision for Linejam. `project.md` is the deeper product
brief; this file is the north star cold agents should read first.

## What Linejam Is

Linejam is a digital paper-folding poetry party game for friends in the same
room. Players write constrained lines while seeing only the previous line, then
reveal complete collaborative poems aloud. The mechanic is settled: nine rounds
with word counts `1, 2, 3, 4, 5, 4, 3, 2, 1`.

The product is not "AI writes poems" and not a social writing platform. It is a
low-friction party loop that creates funny, surprising, shareable artifacts with
people who are already together.

## North Star

One world-class casual party loop: easy to start on a phone, delightful to play
without explanation, fast under party-room conditions, reliable through the
reveal, resilient when guests join late or reconnect, and polished enough that
the finished poem feels worth keeping or sharing.

Depth comes from the players, the constraint, the reveal ceremony, and the
artifact. It does not come from more modes.

## What Must Stay True

- Guest mode and mobile play are launch-bar requirements, not polish.
- One core mode is the product. The deleted expansion arc is evidence, not a
  backlog invitation.
- The assignment matrix, word-count contract, reveal phase, room code, and
  guest token behavior are product-critical mechanics.
- AI players are support for empty seats and solo testing. Their behavior must
  be evidence-backed and should not replace human authorship as the point.
- Sharing matters because poems are the memory of the game. Recap and artifact
  surfaces should preserve the moment without becoming a social network.
- Reliability, security headers, rate limits, and observability are part of the
  launch promise.
- Always-on availability matters more than feature breadth. A single game mode
  that never embarrasses the host beats five clever modes with shaky rooms.

## What Linejam Refuses

- Multiple game modes, leaderboards, gamification, subscriptions, ads, or
  social-network ambitions.
- Ornamental prompts or in-game nudges that dilute the word-count constraint.
- Public launch with known guest/mobile/reveal failures.
- Internal mocks of app modules in tests. Mock only external systems and
  nondeterminism.
- Production Convex mutation or live-key setup without the explicit env gates in
  `AGENTS.md`.

## Current Bets

1. Finish public-launch readiness before adding product surface.
2. Polish the existing loop to an unusually high UI, UX, performance, and
   resilience bar.
3. Keep AI-player work as a reliability and access aid, not a product pivot.
4. Treat print-on-demand booklets as the only revenue stretch worth revisiting
   after the core loop earns it.
5. Keep Powder cards shaped around product outcomes with concrete oracles.

## Where The Depth Lives

- `project.md` is the product brief: target user, glossary, active focus,
  quality bar, patterns, and anti-goals.
- `AGENTS.md` is the agent router, gate contract, invariants, and environment
  boundary map.
- `README.md` is the public project orientation and contributor entrypoint.
- Powder is the authoritative work ledger (`powder list-cards --repo linejam`);
  `backlog.d/` is a retired seed/archive.
- `docs/testing.md`, Dagger code, and hosted `merge-gate` define the validation
  surface.
