## Planning Report

Spec: TASK.md (PRD: Replay Loop, QR Join, Secure Rooms)
Tasks Generated: 10
Total Estimate: 11h
Critical Path: 6h

### Task Summary

| Phase          | Tasks | Estimate | Dependencies |
| -------------- | ----- | -------- | ------------ |
| Schema/Auth    | 3     | 3h       | None         |
| Core Game      | 3     | 3.5h     | Schema/Auth  |
| UX             | 2     | 2h       | Core Game    |
| Safety/Quality | 2     | 2.5h     | Prior tasks  |

### Critical Path

1. Update Convex schema + migrations (1h) -> 2) Guest token issuance/validation (1.5h) -> 3) Room code generator + input changes (0.5h) -> 4) startNewCycle mutation + query scoping (1.5h) -> 5) Reveal/Lobby wiring + Play Again (1h) -> 6) Tests covering replay/auth/code paths (0.5h)

### Risks

- Missing currentGameId filters could mix cycles; mitigate with integration test gating all queries on currentGameId.
- Secret for guest token might be absent in envs; mitigate by adding env var with fallback guard and doc.
- Back-compat for 4-char rooms could regress joins; mitigate by dual-length validation and tests for both.

---

### TODO

- [x] Update Convex schema for cycles

  ```
  Files: convex/schema.ts; convex/game.ts (types), convex/rooms.ts (types)
  Goal: Add room.currentGameId/currentCycle, games.cycle/status union (LOBBY|IN_PROGRESS|COMPLETED), poems.gameId indexes.
  Approach:
  1) Extend schema tables with new fields/indexes (by_room_cycle, by_game, by_room_game_index).
  2) Bump types in generated dataModel if needed (regen convex).
  3) Document migration strategy (legacy rooms keep null currentGameId until Play Again sets).
  Success Criteria:
  - Schema validates; convex code compiles.
  - New indexes present for game/poem lookups.
  Tests: typecheck; convex codegen passes.
  Estimate: 1h
  ```

- [x] Crypto room code generator + backward-compatible inputs

  ```
  Files: convex/rooms.ts; app/join/page.tsx; app/host/page.tsx; components/Lobby.tsx (display); lib (helper if needed)
  Goal: Generate 6-char A-Z0-9 codes using crypto RNG; accept 4-6 chars for join; display spaced pairs.
  Approach:
  1) Replace Math.random generator with crypto.getRandomValues based function; allow uppercase letters+digits.
  2) Enforce uniqueness with loop; keep support for legacy 4-char lookups.
  3) Update join input maxLength/validation to 6; format display in lobby/reveal as pairs (e.g., AB CD EF).
  Success Criteria:
  - New rooms always 6 chars; legacy 4-char rooms still joinable.
  - Inputs prevent lowercase and >6 chars; display uses spacing without altering stored code.
  Tests: unit test generator length/charset; integration test join with 4 and 6 chars.
  Estimate: 0.5h
  ```

- [~] Guest token issuance API (Next) and hook

  ```
  Files: app/api/guest/session/route.ts; lib/auth.ts (client hook); lib/guestToken.ts (helper)
  Goal: Server-mint HttpOnly signed token (guestId + issuedAt) and expose hook to ensure cookie + return guestId to client.
  Approach:
  1) Implement HMAC sign/verify helper using GUEST_TOKEN_SECRET; 30d expiry.
  2) API route: if valid cookie exists, return guestId; else create guestId (uuid/v4), set cookie HttpOnly/SameSite=Lax/path=/, return guestId.
  3) Update useUser hook to consume guest token instead of client-generated localStorage id; keep Clerk path untouched.
  Success Criteria:
  - No client-side generation of guestId.
  - Cookie present after first load; guestId consistent across tabs.
  Tests: unit verify helper tamper fails; API route test (happy + tampered cookie).
  Estimate: 1.5h
  ```

- [ ] Convex guest auth validation

  ```
  Files: convex/lib/auth.ts; convex/users.ts; convex/functions using guestId
  Goal: Validate guest tokens server-side before resolving user; reject tampered/expired tokens.
  Approach:
  1) Add utility to parse/verify token (shared secret) and extract guestId.
  2) Update getUser/requireUser/ensureUserHelper to use verified guestId from token string, not raw input.
  3) Thread token through args where guestId was (rename to guestToken for clarity).
  Success Criteria:
  - Any tampered token throws; existing Clerk auth path unaffected.
  - All convex calls compile with new arg name/types.
  Tests: unit test for auth util; mutation/query tests with valid and tampered tokens.
  Estimate: 1h
  ```

- [ ] startNewCycle mutation + game scoping

  ```
  Files: convex/game.ts; convex/rooms.ts (room status updates)
  Goal: Host-only Play Again mutation that creates new game+poems, bumps currentCycle/currentGameId, resets room to LOBBY; all queries use currentGameId.
  Approach:
  1) Add mutation startNewCycle(roomCode, guestToken); authorize host; ensure room.status COMPLETED; create new game (status LOBBY, cycle+1) and poems; reset room status LOBBY/currentGameId/currentCycle; clear seatIndex on roomPlayers.
  2) Update startGame to target currentGameId and set status IN_PROGRESS; ensure no duplicate games if called twice (idempotent guard).
  3) Scope getCurrentAssignment/getRevealPhaseState/getRoundProgress/submitLine to currentGameId/game.status.
  Success Criteria:
  - Duplicate Play Again clicks do not create multiple games.
  - Queries never surface previous cycles.
  - Room transitions: COMPLETED -> LOBBY (new game) -> IN_PROGRESS -> COMPLETED.
  Tests: convex tests covering mutation happy path, duplicate click idempotency, queries filtered by currentGameId.
  Estimate: 1.5h
  ```

- [ ] Rate limiting for room endpoints

  ```
  Files: convex/rooms.ts; convex/lib/rateLimit.ts (new); env var for limits
  Goal: Throttle createRoom/joinRoom/getRoom per user (guest token or Clerk) per window.
  Approach:
  1) Implement rateLimit helper storing counts in Convex table or in-memory per request context windowStart.
  2) Apply to mutations/queries with configurable env (e.g., MAX_ACTIONS_PER_10M).
  3) Return typed errors for rate limited state.
  Success Criteria:
  - Exceeding threshold returns consistent error without side effects.
  - Normal paths unaffected latency-wise.
  Tests: unit/integration for rate limit helper and join/create paths.
  Estimate: 1h
  ```

- [ ] UI: Play Again + Lobby/Reveal state wiring

  ```
  Files: components/RevealPhase.tsx; components/Lobby.tsx; app/room/[code]/page.tsx
  Goal: Wire Start New Cycle button to startNewCycle mutation; ensure clients react to room.status and currentGameId changes.
  Approach:
  1) Add mutation call to button (host only), show loading/error; hide button when not host.
  2) Ensure page refresh logic uses room.status/currentGameId to transition to lobby and then startGame.
  3) Add inline error handling instead of alert for failures (reuse captureError).
  Success Criteria:
  - Play Again triggers new cycle and returns UI to Lobby without manual refresh.
  - Non-hosts never see actionable controls.
  Tests: happy-dom integration mocking Convex responses to simulate cycle reset; UI renders new lobby state.
  Estimate: 1h
  ```

- [ ] UI: QR join flow

  ```
  Files: components/Lobby.tsx; components/RevealPhase.tsx; app/join/page.tsx; new component components/RoomQr.tsx
  Goal: Display QR linking to /join?code=XXXXXX; join page pre-fills code and focuses name.
  Approach:
  1) Add lightweight QR generator (consider existing dep; add if absent) with token colors matching design tokens; include copy-link fallback.
  2) Show QR for host in Lobby and on Session Complete section; add alt text/caption.
  3) Update join page to read query param code and prefill input.
  Success Criteria:
  - QR renders instantly; link opens join page with code prefilled.
  - Works for 4- and 6-char codes.
  Tests: component test for join page prefill; snapshot for QR component props; manual sanity optional.
  Estimate: 1h
  ```

- [ ] Observability: Sentry context + captureError coverage

  ```
  Files: lib/error.ts; components where new mutations added; convex/game.ts (contexts)
  Goal: Send Sentry errors with roomCode/gameId/cycle context; avoid console.error in prod.
  Approach:
  1) Ensure captureError used in new catch blocks; remove console.error usage.
  2) Add context payloads for startNewCycle/startGame/reveal operations.
  Success Criteria:
  - All new error paths hit Sentry with contextual data.
  Tests: lint for no console.error; unit test for captureError dev logging path if present.
  Estimate: 0.5h
  ```

- [ ] Test suite coverage for new flows
  ```
  Files: tests/ (new specs), vitest setup; convex test harness if available
  Goal: Validate replay, QR prefill, code generator, guest token, rate limit.
  Approach:
  1) Add unit tests: code generator charset/length; guest token verify tamper; rateLimit helper.
  2) Integration: startNewCycle happy/duplicate; getRevealPhaseState uses current game; join page prefill.
  3) E2E/happy-dom: replay cycle flow with mocked Convex responses; ensure UI transitions.
  Success Criteria:
  - New tests pass and improve coverage over 60% thresholds.
  - Critical paths (replay, auth, code) covered.
  Estimate: 1h
  ```

---

Notes / Out of Scope

- Do not expose cycle history UI yet.
- No analytics sink integration until provider chosen.
- No auto-start after Play Again; stays in lobby by design.

Quality Gates

- Run pnpm lint, pnpm typecheck, pnpm test, pnpm build before PR.
- Ensure env wiring for GUEST_TOKEN_SECRET and rate limit values is documented.
