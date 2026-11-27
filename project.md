# Linejam

## Product

A phone-first poetry party game for friends together in one room: easy guest
entry, enjoyable writing, a clear whole-poem reveal, and poems worth keeping.

[`PRODUCT.md`](PRODUCT.md) is the Active Folio and owns what Linejam is and
must do. This brief records accepted direction around it; where they differ,
`PRODUCT.md` wins.

## What stays true

- One human-authored game: nine rounds of `1, 2, 3, 4, 5, 4, 3, 2, 1` words.
  Each writer sees only the preceding line; all nine lines open at reveal.
- Guests play without accounts. Refresh, reconnect, late joins and host
  departure preserve game integrity.
- Private saving and explicit, reversible publication are different actions.
  No hidden poem text leaks to spectators or unauthorized viewers.
- The identity is Contemporary Warm Salon / Tactile Stationery, owned by
  [`DESIGN.md`](DESIGN.md) and the checksum-locked files in `folio/assets/`.
  It supersedes the earlier lavender / DynaPuff / Nunito Sans identity and the
  freeze this brief used to record.
- Phones, large text, keyboards, screen readers, both color modes and reduced
  motion are part of the experience, not optional finishing work.
- No generated player contributions, extra game modes, competitive rankings,
  ornamental prompts, ads or social-network expansion.

## Current direction

Linejam has been recompiled cleanly as one Cloudflare Worker with Durable
Objects (SQLite): one object per room as the single owner of real-time room
state, one archive object, and a static UI served by the Worker
(`PRODUCT.md` `[L1-5]`, [architecture](docs/architecture.md)). The earlier
Next.js / OpenNext / Convex / Rust-WASM / Dagger stack and the vendored Parlor
adapter are retired.

Still ahead, each needing its own authority ([operations](docs/operations.md)):
the production deploy of the recompiled Worker, the import of pre-recompile
data, and the live gate on `linejam.mistystep.io`.

## Vocabulary

- **Room:** the gathering and its invitation code; it can host repeated games.
- **Game:** one complete nine-round session in that room.
- **Poem:** nine accepted lines joined by the game's assignments.
- **Pen name and emblem:** room-facing identity, not authentication.
- **Reading circle:** complete poems, assigned readers and a safe fallback for
  an absent reader.

## Ownership

Current requests authorize work. Powder owns priorities, questions and decisions
in flight; Kanban owns active work. This brief stores accepted direction, not a
second backlog. `PRODUCT.md` owns requirements; `SPEC.md` owns detailed
observable acceptance.
