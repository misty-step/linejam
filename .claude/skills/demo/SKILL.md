---
name: linejam-demo
description: |
  Generate demo artifacts for Linejam's guest-first multiplayer flow. Captures
  GIFs, video, and screenshots for lobby, writing, reveal, and session
  completion evidence in PRs.
  Use when: "make a demo", "demo this", "record walkthrough", "PR evidence",
  "show the app works", "capture screenshots".
  Trigger: /demo.
disable-model-invocation: true
argument-hint: '[feature|PR-number] [--format gif|screenshot|video] [upload]'
---

# /demo

Demo for Linejam means showing the real multiplayer guest loop with visible
state changes, not static shots of the home page.

## Capture Methods

| Feature                     | Method                                   | Tool                       | Output                                                 |
| --------------------------- | ---------------------------------------- | -------------------------- | ------------------------------------------------------ |
| Room creation -> guest join | Recorded browser walkthrough             | `pnpm evidence:guest-flow` | `guest-flow.webm`, `guest-flow.gif`, lobby screenshots |
| Help + theme chrome         | Targeted screenshots during the same run | `pnpm evidence:guest-flow` | `02-help-modal.png`, `03-theme-hyper-lobby.png`        |
| Writing + waiting state     | Targeted screenshots during the same run | `pnpm evidence:guest-flow` | `05-writing-valid.png`, `06-waiting.png`               |
| Reveal + session complete   | Targeted screenshots during the same run | `pnpm evidence:guest-flow` | `07-reveal.png`, `08-session-complete.png`             |

## Workflow: Planner -> Implementer -> Critic

### 1. Plan

For Linejam, every demo must answer:

- Did a host create a live room?
- Did a second player join from a separate browser context?
- Did the game advance through writing into reveal?
- Do the artifacts show at least one meaningful UI delta beyond the default page?

### 2. Capture

- Preferred local run:

```bash
LINEJAM_BASE_URL=http://localhost:3000 pnpm evidence:guest-flow
```

- Repo fallback when local Convex is unavailable:

```bash
LINEJAM_BASE_URL=https://www.linejam.app pnpm evidence:guest-flow
```

Rules:

- Every capture set must include both stills and motion.
- Do not ship a demo that never leaves the home page.
- Keep GIFs under roughly 10MB; the capture script already downsamples for PR use.
- Preserve the raw `.webm` alongside the `.gif`.

## Upload

Use draft release assets for PR evidence:

1. Create or update a draft release tagged `qa-evidence-pr-<number>`.
2. Upload the GIF, WebM, PNG screenshots, and `qa-summary.md`.
3. Link the release and inline the GIF in the PR body or PR comment.

## FFmpeg Quick Reference

```bash
ffmpeg -y -i input.webm \
  -vf "fps=6,scale=640:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer" \
  -loop 0 output.gif
```

## Gotchas

- Default-state evidence proves nothing. The demo must reach at least lobby,
  writing, and reveal.
- This repo currently lacks local Convex bootstrap files. If the local backend
  is not configured, capture against `https://www.linejam.app` and say so.
- Theme changes persist in `localStorage`; reset to `Kenya` before capture if
  you need a consistent baseline.
- GitHub PR comments do not render `.webm` inline. Always upload a `.gif` too.
- Do not commit binary evidence to the repo. Upload it and link it.
