# Make Sharing Privacy Explicit

Priority: P1
Status: pending
Estimate: M

## Goal

Define and enforce whether poems and session artifacts are public-by-link, participant-only, or opt-in public so players understand what persists and what can be indexed or reshared.

## Oracle

- [ ] `pnpm vitest run tests/convex/poems.test.ts tests/hooks/useSharePoem.test.ts`
- [ ] Public poem and future session-share queries check an explicit share/privacy field instead of treating every poem ID as public.
- [ ] `app/poem/[id]/metadata.ts` and OG image generation follow the same privacy decision as the page body.
- [ ] The in-app share UI tells players what the link exposes before copying or invoking native share.
- [ ] Migration/backfill policy is documented for existing poems.

## Children

1. Decide the product privacy contract for individual poems and session recaps.
2. Add schema fields and mutations needed to grant/revoke public share access.
3. Gate `getPublicPoemPreview`, `getPublicPoemFull`, metadata, and OG image routes on that contract.
4. Update share UI and tests so players see the privacy state before sharing.
5. Document the retention/indexing posture in user-facing and operator docs.

## Notes

- Today `getPublicPoemPreview` and `getPublicPoemFull` return content for any valid poem ID, and `/poem/[id]` falls back to the public query for non-participants.
- This can be acceptable only if public-by-link is a deliberate product promise. The backlog item is to make the promise explicit and enforce it consistently.
- This pairs with `006`: session-level sharing should not expand the public surface before the privacy model is clear.

## Repo Anchors

- `convex/poems.ts`
- `convex/schema.ts`
- `components/PoemDisplay.tsx`
- `hooks/useSharePoem.ts`
- `app/poem/[id]/PoemDetail.tsx`
- `app/poem/[id]/metadata.ts`
- `app/poem/[id]/opengraph-image.tsx`
