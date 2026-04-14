# Demo Capture Plan — Linejam

## Must-Demo Features

| #   | Feature                   | Route                               | Before State                      | After State                                   | Artifact                                         |
| --- | ------------------------- | ----------------------------------- | --------------------------------- | --------------------------------------------- | ------------------------------------------------ |
| 1   | Host creates a live room  | `/` -> `/room/[code]`               | Empty host form                   | Lobby with generated room code                | GIF + `01-host-lobby.png`                        |
| 2   | Guest joins in real time  | `/join?code=ABCD` -> `/room/[code]` | Host alone in lobby               | Host and guest both visible                   | GIF + `04-two-player-lobby.png`                  |
| 3   | Word-count writing flow   | `/room/[code]` in progress          | Disabled submit on invalid counts | Enabled submit on exact count + waiting state | GIF + `05-writing-valid.png`, `06-waiting.png`   |
| 4   | Reveal ceremony completes | `/room/[code]` completed            | Hidden poem                       | Revealed poem and `Session Complete`          | GIF + `07-reveal.png`, `08-session-complete.png` |

## Situational Features

| #   | Feature             | When to Demo                                 | Artifact                                                          |
| --- | ------------------- | -------------------------------------------- | ----------------------------------------------------------------- |
| 1   | Help modal          | PR touches onboarding, rules copy, or chrome | `02-help-modal.png`                                               |
| 2   | Theme picker        | PR touches theming or visual polish          | `03-theme-hyper-lobby.png`                                        |
| 3   | Archive/poem detail | PR touches Clerk-only or archive views       | Route screenshots from authenticated run                          |
| 4   | AI poet controls    | PR touches AI player lifecycle               | Separate multiplayer run after confirming AI backend is available |

## Environment Setup

- Dev server: `pnpm dev`
- Preferred local URL: `http://localhost:3000`
- Fallback public URL: `https://www.linejam.app`
- Auth: guest-only for default capture; Clerk only when PR changes `/me/*`
- Prerequisites:
  - Playwright browser installed
  - `ffmpeg` installed
  - Separate browser contexts for host and guest
