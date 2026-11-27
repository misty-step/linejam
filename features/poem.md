# Poem (US-002)

Nine rounds, the limited view, calm waiting, the reading circle.

- Rules: `shared/rules.ts` (`ROUND_WORDS`, `checkLine`, `writerSeat`, `poemForSeat`, `readerSeat`)
- Room: `src/room.ts` — `submit`, `assignmentFor`, `reveal`, `circleView`, `endGame`, `toLobby`
- UI: `web/src/views.ts` (`writing`, `reveal`), drafts and submit in `web/src/main.ts`
- Tests: `tests/worker/game.test.ts`, `tests/worker/room.test.ts`, `tests/faces/design.test.ts`
- Walkthrough: nine rounds → reading circle → recap → Play again; `rapid-submit` scenario
