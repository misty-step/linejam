# 0007: Parallelize only independent database work

- **Status:** accepted
- **Date:** 2026-10-13 (migration; original record undated)
- **Primitives:** poem-game, room-lifecycle
- **Powder:** none recorded

## Context

Sequential awaited database loops added latency to independent seat assignment,
poem creation, poem completion and line-existence checks in `startGame` and
`submitLine`. The original reported 120ms to 30ms for eight players; that is
historical measurement, not a current performance receipt.

## Decision

Use `Promise.all` for those independent operations within a mutation. Do not
parallelize dependent operations (such as creating a room then its game), work
requiring sequential ordering, or read-modify-write operations whose reads depend
on previous writes. Capture `Date.now()` once before a batch sharing `createdAt`
or `completedAt`, so all records receive the same timestamp.

## Consequences

Independent work can overlap without changing semantics, but `map` plus
`Promise.all` is less readable and requires checking independence. This rule
is not permission for unbounded database fan-out; preserve the current bounded
scheduler/database contract and use `setupConvexTest()` for verification.
Revisit if dependencies or ordering requirements change so the batch is no
longer independent.
