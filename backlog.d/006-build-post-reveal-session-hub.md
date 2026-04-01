# Build Post-Reveal Session Hub

Priority: medium
Status: blocked
Estimate: M

## Goal

Turn the end of a session into a resilient group handoff with full-session sharing and clear replay/new-room actions.

## Non-Goals

- Redesign the main write flow
- Add social-network features or persistent chat
- Change poem rendering in archive mode

## Oracle

- [ ] `pnpm vitest run tests/components/RevealPhase.test.tsx tests/components/PoemDisplay.test.tsx`
- [ ] After all poems are revealed, every player sees a shared session-complete hub with replay and sharing actions.
- [ ] The hub allows whole-session sharing without requiring players to open each poem individually.
- [ ] The implementation does not reintroduce host-only dead ends.

## Notes

- This is intentionally blocked on `002` so the lifecycle contract is stable before the new session-complete handoff is layered on top.
- Product rationale: convert peak reveal excitement into replay and sharing instead of leaving the group in a dead-end state.

## Repo Anchors

- `components/RevealPhase.tsx`
- `components/PoemDisplay.tsx`
- `components/RoomChrome.tsx`
