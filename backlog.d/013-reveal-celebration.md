# Stage the reveal like a performance and end with a celebration

Priority: P1 · Status: ready · Estimate: M

## Goal

The reveal screen runs the room like a stage — everyone knows who reads
next — and the session ends by crowning a crowd favorite instead of
petering out into a link list.

## Oracle

- [ ] Reveal screen spotlights "up next": the first unrevealed poem's
      reader is visibly on deck for the whole room; the queue reads as a
      running order, not a status table.
- [ ] Players can heart a poem during/after its reading (favorites already
      exist in schema — surface them in the ceremony); hearts are
      idempotent per player per poem.
- [ ] Recap crowns the most-hearted poem ("room favorite") when any hearts
      were given; ties handled gracefully; zero-heart sessions skip the
      crown without an empty slot.
- [ ] AI lines get their persona moment: when an AI-authored line reveals,
      the persona name is announced with it (not a tiny post-hoc badge).
- [ ] `pnpm test`, `pnpm typecheck`, `pnpm lint` green.

## Notes

The read-aloud is the product's payoff; the digital surface should
choreograph the room, not replace it (no digital applause — the room claps
for real). Favorites table + `by_poem` index already exist
(convex/schema.ts:102); this surfaces them in the moment instead of only in
the archive.

## Children

1. Up-next spotlight + running order.
2. Heart affordance on PoemDisplay + reveal list.
3. Recap room-favorite crown.
4. Persona-announced AI line reveals.
