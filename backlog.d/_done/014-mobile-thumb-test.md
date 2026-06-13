# Pass the thumb test: fix mobile friction on every game surface

Priority: P1 · Status: done · Estimate: M

## Goal

A distracted player holding a phone in a living room can join, write,
wait, and read without a single mis-tap, zoom, keyboard occlusion, or
layout jump.

## Oracle

- [ ] Every interactive target is ≥44px: author dots get real hit zones
      (components/PoemDisplay.tsx:244 was 8px), header icon buttons sized
      up (components/Header.tsx:81+ were 40px).
- [ ] Join code input declares `inputMode`, `autoCapitalize="characters"`,
      `autoCorrect="off"`, `spellCheck={false}` (app/join/page.tsx:87).
- [ ] Writing textarea stays visible when the on-screen keyboard opens
      (scroll-into-view on focus or visualViewport handling).
- [ ] Waiting screen progress line is legible at arm's length (≥16px,
      stronger contrast); poem footer actions reserve their space instead
      of shifting layout when they appear (PoemDisplay.tsx:300).
- [ ] `pnpm test`, `pnpm typecheck`, `pnpm lint` green; touched components
      keep their existing test coverage passing.

## Notes

Mobile audit found the fundamentals strong (inputs ≥56px, fonts >16px, good
aria-live usage, viewport meta correct) — these are the residual HIGH/MED
items. Tooltip-only player names on the waiting screen are unusable on
touch; covered by the drama-pass ticket's waiting-screen work, coordinate
rather than duplicate.
