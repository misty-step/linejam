# Build Reveal Recap Suite

Priority: P1
Status: done
Estimate: L

## Goal

Turn the end of a session into a memorable group recap with full-session sharing, replay, and same-group continuation actions.

## Non-Goals

- Redesign the main write flow
- Add social-network features or persistent chat
- Change poem rendering in archive mode

## Oracle

- [x] `pnpm vitest run tests/components/RevealPhase.test.tsx tests/components/PoemDisplay.test.tsx`
- [x] After all poems are revealed, every player sees a shared session-complete hub with replay and sharing actions.
- [x] The hub allows whole-session sharing without requiring players to open each poem individually.
- [x] The shared artifact has metadata/OG coverage for the session, not only individual poems.
- [x] The hub can start a new room or next cycle with the same theme/group context without host-only dead ends.
- [x] The implementation does not reintroduce host-only dead ends.

## Children

1. Define the session recap data contract from the completed game: poem previews, contributors, theme, room/cycle metadata, and share URL.
2. Replace the all-revealed action stack in `RevealPhase` with a shared recap hub for hosts and guests.
3. Add a session-level public/share route with metadata and OG image coverage.
4. Delete or fold the dead `RevealList` surface after the recap path owns reveal navigation.
5. Extend evidence and component tests to cover the recap, same-group continuation, and non-host paths.

## Notes

- Item `002` is complete, so the lifecycle blocker is gone.
- Product rationale: convert peak reveal excitement into replay and sharing instead of leaving the group in a dead-end state.
- Current code only exposes per-poem sharing in `PoemDisplay`; `RevealPhase` links to the personal archive after all reveals instead of producing a session-level artifact.

## Repo Anchors

- `components/RevealPhase.tsx`
- `components/PoemDisplay.tsx`
- `components/RevealList.tsx`
- `components/RoomChrome.tsx`
- `app/poem/[id]/metadata.ts`

## What Was Built

- Replaced the all-revealed archive stack with a `SessionRecapHub` for host and guest completion states.
- Added session-level sharing, poem replay links, same-room next-round controls, and non-host replay/share guidance.
- Added public `/recap/[code]` and session-level metadata/OG image coverage backed by `getPublicSessionRecap`.
- Gated public recap data until every completed-game poem has been revealed, so shared links cannot spoil the live reveal phase.
- Derived recap starter names from the captured opening-line author instead of mutable room seats.
- Added recap query fallback handling for missing rooms, missing completed games, missing names, empty lines, and AI authors.
- Deleted the unused `RevealList` surface and updated the component map.

## Verification

- `pnpm vitest run tests/components/SessionRecapHub.test.tsx tests/convex/poems.test.ts tests/components/RevealPhase.test.tsx tests/components/PoemDisplay.test.tsx`
- `pnpm test:ci` (840 passed, 1 skipped, branch coverage 85.26%)
- `pnpm typecheck`
- `pnpm lint`
- `pnpm format:check`
- `pnpm ci:dagger:build-check` (route table includes `/recap/[code]` and `/recap/-/opengraph-image`)
- Fresh-context critic returned `VERDICT: BLOCKED`; both findings were rejected with live evidence: `/join?code=` is implemented by `app/join/page.tsx`, and `getRevealPhaseState` already returns `preview`.
- GitHub automated review found public recap pre-reveal exposure, mutable-seat starter labels, invalid nested link/button markup, and defensive author-id handling. Fixed and covered with `pnpm vitest run tests/convex/poems.test.ts tests/components/SessionRecapHub.test.tsx tests/components/RevealPhase.test.tsx`, `pnpm format:check`, `pnpm typecheck`, and `pnpm lint`.

## Workarounds

- Agentic QA runs are preview-only in this repo and require `PLAYWRIGHT_BASE_URL`; run after the branch has a deployed PR preview.
