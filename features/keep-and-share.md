# Keep and share

Stories: US-003
Source: app/me/poems/**, app/poem/[id]/**, convex/poems.ts, convex/shares.ts, convex/favorites.ts, convex/retention.ts, convex/schema.ts, components/archive/**, components/PoemDisplay.tsx, hooks/useSavePoemImage.ts, hooks/useShareLink.ts, hooks/useSharePoem.ts

## Sub-features

Participants keep completed poems in a private archive. Publishing a link is an explicit, reversible act: public reads must resolve an active share, whereas saving a poem image or copying text does not publish it. Unauthenticated spectators cannot fetch unpublished text through page, metadata, or preview routes.

## How to get to it (user POV)

Finish a game, enter the archive as the author, and open a poem. Inspect an unshared poem from a separate unauthenticated browser, deliberately share it, open the issued link as a spectator, then disable sharing and revisit that link.

## Driving it

Convex reads and publication mutations authorize author versus public access; page and share controls expose the distinction. `qa/walk --stories "US-003"` verifies the actual rendered archive, spectator denial, public activation and revocation on a disposable isolated stack. The [sharing privacy contract](../docs/sharing-privacy.md) states the boundaries.

## Gotchas

A room code, poem ID, or inactive slug is not publication. A browser image save is local-only. Revocation stops future service reads, not copies already fetched or third-party caches. Never retain raw poem text, guest tokens, or share URLs in the public walk artifact.
