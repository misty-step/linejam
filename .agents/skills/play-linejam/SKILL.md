---
name: play-linejam
description: Run autonomous multi-player browser QA for Linejam through the rendered human UI using agent-browser sessions. Use for UI/E2E gameplay verification, room lifecycle, and reveal verification without CLI/MCP mutations.
---

# Play Linejam (Browser-Play QA)

Repo-local skill for driving autonomous multi-player sessions through Linejam's
rendered human web UI using pinned `agent-browser` sessions.

```bash
pnpm qa:play-linejam:check
```

Unlike `linejam-cli` and `agent:mcp` (which call Convex mutations directly for
scripted backend state inspection), `play-linejam` exercises the real DOM,
interactive inputs, responsive state transitions, full 9-round writing loop,
reveal phase, and room closure lifecycle through the browser.

## Contracts & Roles

The browser QA flow separates orchestration from execution:

- **Coordinator Contract** (`skill://play-linejam/coordinator.md`): Spawns and
  supervises player agents, manages phase progression with sparse hub messages,
  verifies room closure and join rejection, collects sanitized evidence, and
  enforces session cleanup.
- **Player Contract** (`skill://play-linejam/player.md`): Executes DOM-level
  host, guest, and verifier interactions in isolated browser contexts via
  `agent-browser`.
- **Result Schema** (`skill://play-linejam/result.schema.json`): Draft-2020-12
  machine-readable contract for aggregate and per-player results under
  `.qa/runs/<run-id>/`.

## Runtime Preflight & Dependencies

Skills have no package dependency metadata. Before any browser session:

1. The coordinator runs `pnpm qa:play-linejam:check`.
2. The coordinator verifies `pnpm exec agent-browser --version` outputs
   `0.34.0`.
3. Each browser player runs `pnpm exec agent-browser skills get core` before
   using the CLI so its command guidance matches the pinned binary.

## Target & Authority

The web target is set by `LINEJAM_PLAY_BASE_URL` or `PLAYWRIGHT_BASE_URL`
(default: `http://localhost:3333`).

- **CRITICAL**: NEVER treat `NEXT_PUBLIC_CONVEX_URL` as a web target. That is the
  backend database/function endpoint, not the web application.
- **Authority Boundary**: Only a loopback/local target is authorized by default.
  Any remote target—including shared development, preview, staging, and
  production—writes real rooms, players, and lines and requires explicit
  operation authority naming that target. Configuration or an environment flag
  selects a target; it does not grant mutation authority.
- **Evidence Sanitization**: Structured receipts and manifests must never
  contain room codes, guest tokens, or poem text. Screenshots and video may
  contain synthetic game text; keep them private, inspect them for credentials
  and unrelated user data, and close the room before retaining any artifact
  that exposes its code.

## Session Isolation & Scale

Supports 2 to 6 players (default: 4 players: 1 host + 3 guests). Every participant
(Host, Guests, and Verifier) must run in an isolated browser session using the
`--session` flag:

```bash
pnpm exec agent-browser --session <run-id>-host open <baseUrl>/host
pnpm exec agent-browser --session <run-id>-player-1 open <baseUrl>/join
pnpm exec agent-browser --session <run-id>-verifier open <baseUrl>/join
```

Sessions must never share cookies, local storage, or browsing context.

## Game Lifecycle & Room Closure

A complete autonomous run covers:

1. **Concurrent Spawning**: Coordinator spawns Host and all Guests in one batch;
   Guests wait for the room code.
2. **Room Creation**: Host creates room at `/host`, captures 4-letter room code,
   and signals `ROOM_CREATED` to coordinator.
3. **Lobby Join**: Guests join at `/join?code=CODE` (or `/join`).
4. **9-Round Gameplay**: Host starts game. All players write and seal lines for
   Rounds 1–9 matching target word counts `[1, 2, 3, 4, 5, 4, 3, 2, 1]`.
5. **Reveal Phase**: Players take turns revealing and reading their assigned
   poems in reading circle order until all poems are revealed.
6. **Room Closure**: Host clicks **Back to Lobby** on the recap hub, then clicks
   **Close room** in the lobby.
7. **Join Rejection Verification**: A fresh session (`<run-id>-verifier`)
   attempts to join the closed room code at `/join` and confirms the join is
   rejected (e.g., error alert displayed, no room entry).
8. **Unconditional Cleanup**: Every dynamically allocated `agent-browser --session`
   is closed.

See `skill://play-linejam/coordinator.md` for orchestration details and
`skill://play-linejam/player.md` for UI interaction steps and selectors.
