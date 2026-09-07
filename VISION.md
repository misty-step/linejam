# Linejam Vision

Optional product context, not a work queue, instruction hierarchy, or required
first read. Current requests authorize work; `project.md` owns the product brief
and `DESIGN.md` the selected design. These constraints explain the product's
intent and should be reconciled with an explicit product change, not used to
veto the operator's request. Linear owns current work and prioritization.

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
- Anonymous play is the runtime; accounts are optional persistence. Guest host,
  join, play, and reveal must survive identity-provider failure.
- One core mode is the product. The deleted expansion arc is evidence, not a
  backlog invitation.
- The assignment matrix, word-count contract, reveal phase, room code, and
  guest token behavior are product-critical mechanics.
- Every poem line is authored by an attending human. A player can never be
  replaced by generated, ghostwritten, fallback, or prewritten content.
- Sharing matters because poems are the memory of the game. Recap and artifact
  surfaces should preserve the moment without becoming a social network.
- Saving remains private. Publication is a separate, explicit, reversible act;
  missing or failed consent always means private.
- The shipped identity and both color modes must meet the same mobile, contrast,
  text-scaling, keyboard, screen-reader, and reduced-motion bar.
- Reliability, security headers, rate limits, and observability are part of the
  launch promise.
- Always-on availability matters more than feature breadth. A single game mode
  that never embarrasses the host beats five clever modes with shaky rooms.

## What Linejam Refuses

- Multiple game modes, leaderboards, gamification, subscriptions, ads, or
  social-network ambitions.
- Ornamental prompts or in-game nudges that dilute the word-count constraint.
- Public launch with known guest/mobile/reveal failures.

## Desired experience

Linejam is a host's default creative icebreaker for a 2–6 person gathering: a
new group starts on phones without accounts or explanation, finishes reliably,
performs the reveal aloud, keeps a private artifact, and intentionally chooses
whether to publish it. The team can see where real parties stall or replay
without collecting poem text. The shipped identity is accessible, one declared
production control plane is boring to deploy and roll back, and incidents are
visible before a player has to report them.

## Where The Depth Lives

- `project.md` is the product brief: target user, glossary, selected identity,
  quality expectations, patterns, and anti-goals.
- `AGENTS.md` is the agent router, gate contract, invariants, and environment
  boundary map.
- `README.md` is the public project orientation and contributor entrypoint.
- Linear owns current work, prioritization, and selected unresolved opportunities;
  historical GitHub Issues remain linked evidence, not a required intake queue.
  `CONTRIBUTING.md` explains how to start from the current request. Sentry remains
  the incident-evidence platform; [#393](https://github.com/misty-step/linejam/issues/393)
  records its production cutover.
- `docs/testing.md`, Dagger code, and hosted `merge-gate` define the validation
  surface.
