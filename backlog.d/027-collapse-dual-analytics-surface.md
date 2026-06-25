# Collapse the dual analytics surface to one funnel path

Priority: P3 · Status: blocked · Estimate: S

Blocked on a product decision: PostHog-as-events vs Vercel-as-events.

## Goal

One analytics dependency owns product-funnel events; the other is removed or
given a documented single-responsibility role — ending the "two deps, the
deprecated one does all the real work" split.

## Oracle

- [ ] Exactly one analytics path owns the 7 product-funnel events; grep shows no
      event flowing through a path the docs call deprecated.
- [ ] The other surface is either removed (drop the dependency) or has a
      documented, deliberate role (e.g. PostHog = session/pageview only).
- [ ] `project.md` / CLAUDE.md analytics notes match the implemented reality.

## Notes

From the architecture/simplification lane. `lib/analytics.ts` (Vercel `track()`)
carries all 7 funnel events; `lib/posthog/` only ever captures `$pageview` — so
PostHog is event-dead despite the memory note that "new event work goes through
PostHog." Either finish the migration (move events to PostHog, drop
`@vercel/analytics` + `lib/analytics.ts`) or demote PostHog and accept Vercel as
the funnel surface. Low stakes; pure coherence. Decision-required before pickup.
