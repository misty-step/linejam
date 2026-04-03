---
name: linejam-qa
description: |
  QA for Linejam's guest-first multiplayer poetry flow. Verifies the real app
  from landing page through lobby, writing, and reveal, with evidence capture
  for PRs.
  Use when: "run QA", "test this", "verify the feature", "QA this PR",
  "check the guest flow", "capture evidence".
  Trigger: /qa.
disable-model-invocation: true
argument-hint: '[base-url|route|PR-number]'
---

# /qa

QA for Linejam means exercising the real multiplayer guest flow, not just
running unit tests. The default path is the public guest journey:
landing page -> host room -> guest join -> 9 writing rounds -> reveal.

## Prerequisites

- Preferred local target: `pnpm dev` with a working `.env.local` that points
  Next.js and Convex at the same backend.
- Fallback target when local Convex is not configured: set
  `LINEJAM_BASE_URL=https://www.linejam.app`.
- Playwright browsers and `ffmpeg` must be installed for visual evidence.

## Dev Server

```bash
pnpm dev
```

## Critical Paths

| #   | Route                           | What to Check                                                                                                                   |
| --- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `/`                             | Landing page renders primary CTAs and global chrome without runtime errors.                                                     |
| 2   | `/host`                         | Guest session initializes, name entry enables `Create Room`, room creation redirects to `/room/[code]`.                         |
| 3   | `/join`                         | Query-param room codes prefill correctly, form validation blocks incomplete submits, invalid room codes show friendly feedback. |
| 4   | `/room/[code]` in `LOBBY`       | Host sees room code, invite/help/theme controls work, second browser context joins and appears in real time.                    |
| 5   | `/room/[code]` in `IN_PROGRESS` | WordSlots enforce exact counts, invalid text keeps submit disabled, waiting state reflects submission progress.                 |
| 6   | `/room/[code]` in `COMPLETED`   | Reveal buttons work, poems render fully, session reaches `Session Complete` after both players reveal.                          |

## Interactive Flows

| Flow             | Steps                                                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Guest flow smoke | Run `LINEJAM_BASE_URL=<url> pnpm evidence:guest-flow` and review the generated summary, screenshots, GIF, and console log.                        |
| Validation check | On round 1, verify `Seal Your Line` is disabled at 0 words, disabled at 2 words, and enabled at exactly 1 word.                                   |
| Chrome check     | In the lobby, open `How to play`, open theme picker, switch to `Hyper`, and confirm the room still works after the theme change.                  |
| Clerk boundary   | If a PR touches `/me/*`, confirm behavior both with Clerk configured and in guest-only mode, because middleware redirects guests away from `/me`. |

## Evidence

- Primary command:

```bash
LINEJAM_BASE_URL=https://www.linejam.app pnpm evidence:guest-flow
```

- Evidence lands in `/tmp/linejam-evidence-*`.
- Required artifacts for UI-affecting PRs:
  - `guest-flow.gif`
  - `guest-flow.webm`
  - route screenshots for lobby, writing, reveal, and session complete
  - `qa-summary.md`

## Output

- Status: PASS / FAIL
- Base URL used
- Critical path checklist
- Console and page errors seen during the run
- Evidence directory and artifact names
- Merge recommendation

## Gotchas

- This repository does not include a local Convex config or `.env.local`; if
  you cannot boot a local backend, run the evidence flow against
  `https://www.linejam.app` instead of pretending local QA happened.
- `/me/*` is protected by Clerk middleware. In guest-only mode it redirects to
  `/`, so archive/favorites are not part of the default guest smoke test.
- Room-creation and full-game E2E rely on guest tokens. If Next.js and Convex
  do not share the same `GUEST_TOKEN_SECRET`, mutating flows will fail or skip.
- Multi-player QA requires separate browser contexts. Reusing one context makes
  host and guest share a cookie and invalidates the test.
- Reveal screens animate and state-sync through Convex. Wait for visible text,
  not arbitrary sleeps, before declaring success or failure.
