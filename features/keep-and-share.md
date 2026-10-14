# Keep and share

Stories: US-003
Source: app/me/poems/**, app/poem/[id]/**, convex/poems.ts, convex/shares.ts, convex/favorites.ts, convex/retention.ts, convex/schema.ts, components/archive/**, components/PoemDisplay.tsx, hooks/useSavePoemImage.ts, hooks/useShareLink.ts, hooks/useSharePoem.ts

Acceptance: [SPEC.md — US-003](../SPEC.md#us-003-live-save-privately-and-publish-on-purpose).

## Driving it

Convex reads and publication mutations authorize author versus public access; page and share controls expose the distinction. `qa/walk --stories "US-003"` verifies the actual rendered archive, spectator denial, public activation and revocation on a disposable isolated stack. The [sharing privacy contract](../docs/sharing-privacy.md) states the boundaries.

Never retain raw poem text, guest tokens or share URLs in the public walk artifact.
