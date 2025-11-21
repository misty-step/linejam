PRD: Replay Loop, QR Join, Secure Rooms

1. Executive Summary

- Problem: Reveal-phase Play Again button is inert; post-game flow dead-ends. Joining requires manual code entry. Room codes weak (4 chars, Math.random); guest IDs client-controlled. Net: replay friction + security risk.
- Solution: Add host-only Play Again flow that spins a fresh cycle in same room with current roster; show QR code that deep-links to join with prefilled code; raise room code entropy (6-char crypto) and move guests to server-issued signed sessions with basic rate limits.
- Value: Faster replays, fewer join errors, harder room scraping/impersonation. Success = >=70% of completed games start a new cycle within 60s; median join time <10s; zero spoofed guest collisions in logs.

2. User Context & Outcomes

- Host wants to keep group momentum after a reveal; should not re-share links or recreate rooms.
- Guests want a one-tap join (scan) with no code typing; trust that rooms aren't hijacked.
- Outcomes: replay in <3 clicks, join success >98%, security posture improved without UX drag.

3. Requirements

- Functional
  - Play Again (host only): from Reveal view, trigger new cycle setup using existing room + roster. Room returns to Lobby state; host must explicitly start when ready. All clients auto-redirect based on room.status changes.
  - Cycle integrity: new game object + poems for the cycle; old poems/lines stay archived but excluded from "current cycle" queries.
  - QR Join: lobby shows scannable QR linking to `/join?code=XXXXXX`; join page prefills code and autofocuses name. Also surface QR on Reveal "Session Complete" for late joiners of replay.
  - Room code generation: 6-char A-Z0-9 uppercase via crypto-secure RNG; uniqueness enforced. Join accepts 4-6 chars for backward compatibility; display uses spaced pairs for readability.
  - Rate limiting: throttle createRoom, joinRoom, getRoom to N attempts per user token per 10 minutes (tunable env). On breach, return typed error.
  - Guest identity: guest session token minted server-side; contains guestId + issuedAt, HMAC signed; stored HttpOnly, path=/, 30d. Client no longer supplies raw guestId; Convex reads/validates token before resolving user.
- Non-functional
  - Perf: Play Again mutation <300ms p99; QR render instant (<50ms after data ready); code RNG negligible.
  - Reliability: replay cannot start if any prior cycle data migration fails; idempotent Play Again (duplicate clicks no duplicate games).
  - Security: no guessable codes; guest token tamper-evident; rate-limit bypass requires key leak.
- Infrastructure
  - Quality gates: lint, typecheck, vitest, build stay green; add tests for new mutations/hooks.
  - Observability: capture errors via captureError + Sentry context (roomCode, gameId, cycle); structured logs when added later.
  - Design consistency: Tailwind tokens only; QR component styled to match Lobby card aesthetic; A11y: QR has alt text + copyable link fallback.
  - Secrets: HMAC secret `GUEST_TOKEN_SECRET` in env; no tokens in logs.

4. Architecture Decision

- Chosen: Multi-cycle with explicit game versioning and currentGame pointer.
  - Add `currentGameId` + `currentCycle` on rooms. Each cycle = new `games` row (status LOBBY|IN_PROGRESS|COMPLETED) and poems tied to that game. Lines remain linked to poems.
  - All game/read queries filter by `currentGameId`; Reveal/Writing/Lobby derive state from that record only.
  - Play Again flow: host calls `game.startNewCycle(roomCode)` -> verify room.status COMPLETED; create new game+poems, set room.status LOBBY, update pointer/currentCycle++, null seatIndex; clients re-render lobby; host then calls existing startGame.
  - Guest auth: Next API `/api/guest/session` mints token; client hook reads cookie to supply token to Convex calls. Convex `getUser/ensureUser` validates token signature before using guestId.
  - QR: generated client-side with lightweight QR lib; payload = absolute join URL including code param.
- Rationale: keeps deep module boundaries (room owns pointer; games immutable archives), avoids destructive deletes, enables history/analytics later.
- Alternatives (score: value 40, simplicity 30, explicitness 20, risk 10; higher is better)
  - A) Delete old data, reuse single game row: 40+35+15+15=105. Rejected-destroys archive, leaks old poems into reveals unless hard-deleted.
  - B) Remove button only: 0+70+60+90=220 negative value; fails core user need. Rejected.
  - Chosen approach: 90+70+70+60=290 best balance.

5. Data & API Contracts

- Tables
  - rooms: add `currentGameId: Id<'games'>`, `currentCycle: number` (starts at 1).
  - games: add `status` union LOBBY|IN_PROGRESS|COMPLETED, `cycle: number`; index `by_room_cycle`; queries always pick room.currentGameId.
  - poems: add `gameId: Id<'games'>`; indexes `by_game`, `by_room_game_index`.
  - Optional rateLimit table: `{ key: string, windowStart: number, count: number }` indexed by key.
- Mutations/queries
  - `game.startNewCycle({ roomCode, guestToken })` -> creates new game+poems, resets room.status to LOBBY, bumps cycle, returns room/game ids.
  - `rooms.createRoom/joinRoom/getRoom`: accept guestToken (server-signed), enforce rate limit, generate 6-char codes.
  - Client hook `useGuestSession`: on load, call `/api/guest/session` to ensure token cookie exists and return guestId (decoded) + token for Convex.
  - Join URL: `/join?code=XXXXXX`; join page reads query param to prefill code (no local storage).

6. Implementation Phases

- MVP (ship fast): guest token mint/validate; 6-char codes + input updates; Play Again button wired to new cycle mutation; queries scoped to currentGameId; QR shown in Lobby with copy link fallback.
- Hardening: rate limiting create/join/getRoom; idempotency guard on startNewCycle; analytics events for replay/joins; UI states/spinners.
- Future: expose past cycles list per room; host setting for auto-start new cycle; configurable code length.

7. Testing & Observability

- Unit: convex mutations for startNewCycle, code generator, rate limiter, guest token verifier (happy + tamper cases).
- Integration: client flow tests for QR prefill, join with 6-char code, replay transition (COMPLETED -> LOBBY -> IN_PROGRESS).
- E2E (happy-dom): replay loop with 3 players; duplicate Play Again click does not duplicate game.
- Telemetry: Sentry tags (roomCode, cycle, gameId); log rate-limit hits; Web Vitals unchanged by QR render; add trace span for replay mutation if OTEL available.

8. Risks & Mitigations

- Mixing old/new data if filters missed -> Mitigate with `currentGameId` gate on all game/reveal queries; add integration test.
- Token key leak -> rotate HMAC secret; short token TTL? (30d) with rolling refresh; server-only secret storage.
- Back-compat for existing 4-char rooms -> accept 4-6 chars; migration leaves room.code unchanged for existing records; tooltip explains legacy codes.
- Rate limit false positives in shared IPs -> key on guest token/clerk id over IP; configurable thresholds.

9. Open Questions / Assumptions (need answers to finalize)

- Target rate-limit numbers? (e.g., 10 joins per 10 min per token).
- Should Play Again immediately reshuffle and start, or return to lobby for consent? (assumed: return to lobby).
- Do we need to surface cycle history/labels in UI now, or keep silent?
- Is guest token HMAC secret already available in env management? (assume we can add).
- Should QR also include displayName param for kiosk/host typing? (assume no; keep name typed by guest).
- Analytics targets: which event sink (Segment? self-built)? None currently-ok to omit.
