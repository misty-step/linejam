# Host migration: promote a participant when the host leaves

Priority: P2 · Status: ready · Estimate: M

## Goal

When a room's host goes away (stale presence) but the game continues, promote a
present participant to host so host-only affordances — `summonGhostwriter`,
mode selection in a rematch lobby, `closeRoom` — are never permanently stranded
behind a vanished host. Backlog 016 guarantees a host-departed game still
_completes_ (the correctness floor); this item restores host _agency_ for the
remaining players.

## Oracle

- [ ] A deterministic rule picks the next host (e.g. lowest `seatIndex` among
      non-stale humans) and reassigns `rooms.hostUserId`, triggered when the
      current host is stale past a threshold (reuse `isPresenceStale`).
- [ ] After migration the new host can `summonGhostwriter`, pick a mode for the
      next cycle, and `closeRoom`; the old host regains nothing special if they
      return mid-game.
- [ ] Promotion is idempotent and never demotes a present, active host.
- [ ] Integration test (convex-test) covers: host goes stale mid-game →
      promotion fires → new host can summon the ghostwriter.

## Notes

Deferred from backlog 016 (open question: "Should host migration land here or as
a follow-up?" → follow-up). Likely rides the same abandonment sweep or a
lighter presence-driven trigger. Keep the guest-first flow working (promote
signed-JWT guests, not just Clerk users).
