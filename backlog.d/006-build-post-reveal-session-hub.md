# Build Reveal Recap Suite

Priority: P1
Status: ready
Estimate: L

## Goal

Turn the end of a session into a memorable group recap with full-session sharing, replay, and same-group continuation actions.

## Non-Goals

- Redesign the main write flow
- Add social-network features or persistent chat
- Change poem rendering in archive mode

## Oracle

- [ ] `pnpm vitest run tests/components/RevealPhase.test.tsx tests/components/PoemDisplay.test.tsx`
- [ ] After all poems are revealed, every player sees a shared session-complete hub with replay and sharing actions.
- [ ] The hub allows whole-session sharing without requiring players to open each poem individually.
- [ ] The shared artifact has metadata/OG coverage for the session, not only individual poems.
- [ ] The hub can start a new room or next cycle with the same theme/group context without host-only dead ends.
- [ ] The implementation does not reintroduce host-only dead ends.

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
