# Decisions

A steering veto list. Open it before proposing a new primitive, surface, or
storage home. Write a record after deciding *not* to build something the next
agent will otherwise re-propose. Do not write one per PR. Start from
[0000-template.md](0000-template.md); see [primitives.yaml](../architecture/primitives.yaml).

## Steering

- [0001](0001-hybrid-auth-signed-guest-tokens.md): signed guest proof alongside Clerk; no unsigned guest identity.
- [0002](0002-assignment-matrix-derangement.md): immutable upfront assignments, not lazy per-round assignment.
- [0003](0003-game-state-via-query-not-pointer.md): query game state, not a mutable room pointer.
- [0008](0008-pen-names-write-time-capture.md): preserve write-time room bylines; no profile-based rewriting.

## Historical

Former ADRs, unchanged; their numbers stay reserved. No renumbers.

- [0007](historical/0007-parallel-database-writes.md): completed independent-write performance change.
