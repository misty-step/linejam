# Make Sharing Privacy Explicit

Priority: P1
Status: done
Estimate: M

## Goal

Define and enforce whether poems and session artifacts are public-by-link, participant-only, or opt-in public so players understand what persists and what can be indexed or reshared.

## Oracle

- [x] `pnpm vitest run tests/convex/poems.test.ts tests/hooks/useSharePoem.test.ts`
- [x] Public poem and future session-share queries check an explicit share/privacy field instead of treating every poem ID as public.
- [x] `app/poem/[id]/metadata.ts` and OG image generation follow the same privacy decision as the page body.
- [x] The in-app share UI tells players what the link exposes before copying or invoking native share.
- [x] Migration/backfill policy is documented for existing poems.

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

## What Was Built

- Chose opt-in public-by-link as the privacy contract for poems and completed session recaps.
- Added explicit `publicShareEnabled` fields on poems and `publicRecapEnabled` fields on games, with enable/disable timestamps.
- Added participant-checked Convex mutations to grant and revoke public poem and session recap access.
- Gated public poem preview/full queries and public session recap queries on those explicit fields, which also gates page metadata and Open Graph images because they already read through the same public queries.
- Updated poem and session share UI so players see that sharing makes the artifact public to anyone with the link before copying, native sharing, or opening the shared recap.
- Documented the existing-data policy: missing legacy fields are private until a participant shares again.

## Verification

- Red oracle: `pnpm vitest run tests/convex/poems.test.ts tests/hooks/useSharePoem.test.ts tests/hooks/useShareLink.test.ts` failed before implementation on missing privacy gates and pre-share hooks.
- `pnpm vitest run tests/convex/poems.test.ts tests/convex/shares.test.ts tests/hooks/useSharePoem.test.ts tests/hooks/useShareLink.test.ts tests/components/PoemDisplay.test.tsx tests/components/SessionRecapHub.test.tsx tests/components/RevealPhase.test.tsx`
- `pnpm exec prettier --write README.md docs/sharing-privacy.md convex/schema.ts convex/poems.ts convex/shares.ts hooks/useShareLink.ts hooks/useSharePoem.ts components/PoemDisplay.tsx components/SessionRecapHub.tsx components/RevealPhase.tsx 'app/poem/[id]/PoemDetail.tsx' tests/convex/poems.test.ts tests/convex/shares.test.ts tests/hooks/useShareLink.test.ts tests/hooks/useSharePoem.test.ts tests/components/SessionRecapHub.test.tsx tests/components/RevealPhase.test.tsx`
- `pnpm format:check`
- `pnpm typecheck`
- `pnpm lint`
- Fresh adversarial review: `opencode run -- ... /tmp/linejam-009.diff` first found that private public-query misses left `/poem/[id]` in a loading state; fixed with `tests/app/poem-detail.test.tsx`, then reran the same critic packet and got `NO BLOCKING FINDINGS`.
- Post-fix regression set: `pnpm vitest run tests/app/poem-detail.test.tsx tests/convex/poems.test.ts tests/convex/shares.test.ts tests/hooks/useSharePoem.test.ts tests/hooks/useShareLink.test.ts tests/components/PoemDisplay.test.tsx tests/components/SessionRecapHub.test.tsx tests/components/RevealPhase.test.tsx`
- Final local gate: `pnpm ci:prepush` passed with Dagger `all-no-e2e: ok` and `e2e: ok`.

## Workarounds

- Existing links for poems and recaps without explicit public fields now resolve as private/not found until a participant shares them again.
