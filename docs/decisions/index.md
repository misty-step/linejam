# Decisions

A steering veto list. Open it before proposing a new primitive, surface, or
storage home. Write a record after deciding _not_ to build something the next
agent will otherwise re-propose. Do not write one per PR. Start from
[0000-template.md](0000-template.md); see [primitives.yaml](../architecture/primitives.yaml).

## Steering

- [0001](0001-hybrid-auth-signed-guest-tokens.md): signed guest proof alongside Clerk; no unsigned guest identity.
- [0002](0002-assignment-matrix-derangement.md): immutable upfront assignments, not lazy per-round assignment.
- [0003](0003-game-state-via-query-not-pointer.md): query game state, not a mutable room pointer.
- [0007](0007-parallel-database-writes.md): parallelize independent work only; preserve batch timestamps and dependency ordering.
- [0008](0008-pen-names-write-time-capture.md): preserve write-time room bylines; no profile-based rewriting.

## Historical

None: all five source ADRs retain binding choices or vetoes. No renumbers.

Numbers 0004–0006 are reserved gaps: no records with those numbers exist in
`origin/master:docs/adr/` at migration. Do not reuse them.
