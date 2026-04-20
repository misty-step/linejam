---
name: qa
description: |
  Browser-driven QA for Linejam — exercise the 9-round cycle end-to-end, capture
  evidence, file bugs into backlog.d/. Invoked as `/qa [route|feature|@pr]`.
  Use when: "run QA", "verify this", "QA the reveal flow", "exploratory test",
  "capture guest-flow evidence", "QA before merge", "check Clerk room join".
---

# /qa — Linejam

Linejam QA verifies the **nine-round cycle** under real auth, real Convex,
real Canary ingest. Tests passing is not QA. A green `pnpm ci:prepush` run
means the gate passed — it does not mean a human can play the game.

This skill runs authoritative E2E specs, drives exploratory scenarios the
specs don't cover, and captures evidence for `/demo` consumption.

## Execution Stance

You are the executive. Hold scope, severity, and the final pass/fail call.
Delegate exploration runs and evidence capture to subagents. Do not run
`pnpm dev` or `convex dev` yourself — they are already running in the user's
other terminal (Invariant #2). Coordinate timing with the user.

## Authoritative Surfaces

- **Evidence spec**: `tests/e2e/guest-flow.evidence.spec.ts` is the canonical
  client-side QA run. Serial, single worker, no retries. Drives host + guest
  contexts through all nine rounds and reveal. Run via `pnpm test:e2e:evidence`
  (requires `GUEST_TOKEN_SECRET` + `LINEJAM_EVIDENCE_DIR` + `LINEJAM_EVIDENCE_RESULT_FILE`).
- **Full evidence harness**: `pnpm evidence:guest-flow` — wraps the spec,
  packages the host video as `guest-flow.webm`, converts to `guest-flow.gif`
  via ffmpeg, emits `manifest.json` + `qa-summary.md`. Defaults to
  `https://www.linejam.app`; override with `--base-url` or `LINEJAM_BASE_URL`.
- **Smoke config**: `playwright.smoke.config.ts` targets `PLAYWRIGHT_BASE_URL`
  (preview or prod). Matches only `prod-smoke.spec.ts`, workers=1, retries=2,
  video + trace on failure. Run via `pnpm test:e2e:smoke`.
- **Full E2E suite**: `pnpm test:e2e` runs every spec _except_ `@evidence`-tagged
  ones. Uses `playwright.config.ts` (port `PORT_E2E` default 3333, screenshots
  on failure, trace on first retry). E2E specs currently land: `auth.spec.ts`,
  `errors.spec.ts`, `favorites.spec.ts`, `game-flow.spec.ts`,
  `room-auth.spec.ts`, `room-chrome-layout.spec.ts`.
- **Canary during runs**: QA runs hitting prod/preview emit Canary events via
  `components/CanaryClientObserver.tsx`. Hosted responder runs with
  `LINEJAM_SMOKE_RUNNER=playwright`. Surface Canary event IDs in bug reports.

## Auth Matrix

| Mode                | Required env                                                                                             | Gate                                |
| ------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Guest (default)     | `GUEST_TOKEN_SECRET` for local; `E2E_BASE_URL` for remote                                                | Evidence + most specs               |
| Clerk authenticated | `CLERK_SECRET_KEY` + `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (+ `PLAYWRIGHT_CLERK_TEST_EMAIL` for live keys) | `auth.spec.ts`, `room-auth.spec.ts` |
| Enforced auth       | `PLAYWRIGHT_REQUIRE_AUTH_E2E=1`                                                                          | Fails closed if Clerk env missing   |

Clerk smoke user auto-provisions on test keys; live keys refuse and require a
precreated account at `PLAYWRIGHT_CLERK_TEST_EMAIL`. The `convex` JWT template
must exist on the Clerk instance — Dagger auto-creates on dev unless
`LINEJAM_ALLOW_LIVE_CLERK_TEMPLATE_CREATE=0`. Protected-route coverage signs
in per-context inside the live browser; there is no serialized Clerk storage state.

## Routing

| Intent                                 | Action                                                         |
| -------------------------------------- | -------------------------------------------------------------- |
| "run QA", no specifics                 | Run the exploratory ladder below + `pnpm test:e2e:evidence`    |
| "capture evidence" / "for the PR"      | `pnpm evidence:guest-flow` → hand artifacts to `/demo`         |
| "smoke prod" / "smoke preview"         | `PLAYWRIGHT_BASE_URL=<url> pnpm test:e2e:smoke`                |
| "QA the reveal phase" / single feature | Targeted exploratory run (scenarios §) + screenshot-only       |
| "QA this PR"                           | Full E2E + evidence + ≥2 exploratory scenarios from §Scenarios |
| "verify @<spec>"                       | Run only that spec file via `playwright test <path>`           |

## Ladder

1. **Check state before running.** Confirm with the user: Convex dev server up?
   Correct deployment? Clerk env present for authed scenarios? If QA targets
   preview/prod, confirm base URL.
2. **Start from the gate.** If the user hasn't run `pnpm ci:prepush` on the
   branch yet, ask whether to run it first or scope QA to the specific feature.
   A red gate makes QA findings ambiguous.
3. **Run the evidence spec** (`pnpm test:e2e:evidence`) for client-side QA
   anchor. This covers rounds, word-count validation, theme switch,
   help modal, reveal, and session-complete transitions for two guests.
4. **Dispatch exploratory scenarios** from §Scenarios. Parallel subagents where
   scenarios are independent; serial when they share a room state.
5. **Classify findings** (§Severity). P0 blocks merge/ship. P1 filed to
   `backlog.d/` before merge. P2 filed to `backlog.d/` for a later cycle.
6. **Hand evidence to `/demo`.** Artifacts live at `LINEJAM_EVIDENCE_DIR`
   (default `$TMPDIR/linejam-evidence-<timestamp>/`). `/demo` uploads via
   draft GitHub release.

## Scenarios

Exercise these as the exploratory bar above and beyond the committed specs.
Each scenario names the game-specific failure mode it's hunting.

1. **Solo guest + three AI players, full cycle.** Host adds three AI personas,
   runs all nine rounds, reaches reveal, shares a poem. Failure mode: AI
   generation stalls at a word-count boundary (see `lib/wordCount.ts` hyphenation
   rule), OpenRouter timeout leaves a round stuck.
2. **Two humans, mid-session join.** Second player joins after round 2. The
   assignment matrix (`convex/lib/assignmentMatrix.ts`) must remain a valid
   derangement — no player writing consecutive lines for the same poem. Verify
   new player gets rounds 3–8 assignments, and reveal phase assigns them a poem.
3. **Clerk auth room join.** Signed-in Clerk user joins an anonymous host's
   room. Confirm `window.Clerk.session.getToken({ template: 'convex' })` resolves
   — Gotcha #5. If the `convex` template is missing, this scenario dies silently
   and the user appears to "never load."
4. **Word-count violations.** Submit text with wrong word count (under, over,
   hyphenated edge case). Submit button must stay disabled; `errorFeedback.ts`
   message visible; Canary event emitted with category tagged.
5. **Theme switch mid-game.** Cycle kenya → mono → vintage-paper → hyper
   between rounds. Confirm no layout reflow breaks the WordSlots indicator,
   pen-name input focus persists, and ThemeProvider context doesn't leak state.
6. **Network interruption.** Go offline mid-round via DevTools, submit, come
   back online. Convex `useQuery` must resubscribe and the line must either
   land or prompt a clean retry. `useQuery` errors are thrown, not returned
   (Gotcha #4) — ErrorBoundary catches or the round hangs.
7. **Help modal accessibility.** Floating `?` button opens the modal, tab
   order reaches close + all content, Escape closes. No focus trap leak to
   background. Delegate to `a11y-auditor` if scope is broader than smoke.
8. **Poem share flow.** Click share → clipboard contains the poem URL →
   paste into an incognito window → page renders poem for an anonymous visitor.
   OG image generates (`app/poem/[id]/opengraph-image.tsx`).
9. **Room code entry.** Enter `ABCD`, formatted display should read `AB CD`
   per `lib/roomCode.ts formatRoomCode`. Enter `AB CD` with the space — must
   also join. Case insensitivity confirmed.
10. **Reveal phase read-aloud.** Each player assigned exactly one poem.
    Pen names display at write-time (captured on the line, not pulled from
    current user). Host can advance reveal; guest can advance reveal.
    Session-complete state persists on refresh.

## Severity

- **P0 — blocks ship.** Cycle cannot complete. Data loss. Auth broken for
  a supported mode. Canary silent on regression. Never merge.
- **P1 — fix before merge.** Scenario fails but workaround exists. Copy/text
  wrong. Theme breaks one layout. File `backlog.d/NNN-*.md` and fix in
  current PR or stacked PR.
- **P2 — log and ship.** Cosmetic, edge case, non-supported browser. File
  `backlog.d/NNN-*.md` with priority=p2.

## Bug Filing

Backlog source-of-truth is `backlog.d/` per Invariant #10 — **not** GitHub
Issues. As of 2026-04-20 the repo has zero open GH issues.

Template (`backlog.d/NNN-<kebab-title>.md`):

```markdown
# bug(<area>): <one-line>

- Priority: p0 | p1 | p2
- Status: open
- Estimate: <S|M|L>
- Severity: blocks-play | fix-before-merge | edge-case

## Goal

<Restate user-facing outcome that should hold.>

## Oracle

<How we'll know it's fixed. Name the spec to add or the manual repro to pass.>

## Repro

- Base URL: <localhost:3333 | preview | prod>
- Auth: guest | clerk (<email>)
- Theme: kenya | mono | vintage-paper | hyper
- Exact steps (numbered)
- Expected vs actual

## Evidence

- Canary event ID: <uuid or "none captured">
- Playwright trace: <path> (or "n/a — manual repro")
- Screenshot: <path>
```

Name the `<area>` with repo terminology: `lobby`, `writing`, `reveal`, `share`,
`theme`, `auth`, `ai`, `canary`, `assignment-matrix`, `room-chrome`. Don't
invent `document`, `entry`, `session-id` — see Terminology in repo brief.

## Flake Triage

Playwright flake in linejam is almost never the test (Gotcha #8). Before
refiling or rerunning more than twice, check in order:

1. **Clerk smoke-account drift.** Does `PLAYWRIGHT_CLERK_TEST_EMAIL` exist
   in the target Clerk instance? Live keys refuse auto-provision.
2. **Convex dev deployment out-of-sync.** `convex/_generated/api.d.ts` stale?
   Ask the user to run `pnpm dev:convex` (Invariant #2 — don't run it yourself).
3. **`GUEST_TOKEN_SECRET` mismatch.** Guest JWT signing differs between Vercel
   and Convex — guest joins silently drop (Invariant #8).
4. **Placeholder Canary keys.** Build-bearing lanes fail fast (Invariant #4);
   runtime CanaryClientObserver goes quiet otherwise.
5. **Clerk `convex` JWT template missing.** Dagger auto-creates on dev; in
   prod `LINEJAM_ALLOW_LIVE_CLERK_TEMPLATE_CREATE=0` means Clerk sessions exist
   but `getToken({ template: 'convex' })` returns null and auth calls fail.

Only after all five are verified green should you treat the spec as flaky.

## Subagent Delegation

From `/Users/phaedrus/Development/spellbook/agents/` — no others.

- **`a11y-auditor`** — scenario 7 (help modal) or any broader a11y pass.
  Pair with `a11y-critic` for signoff, `a11y-fixer` for patches.
- **`critic`** — independent verification of evidence the same agent captured.
  Required when the run passed but you didn't see the artifacts yourself.
- **`carmack` / `grug` / `ousterhout`** — for severity judgment on design-
  implicated findings (e.g., "is this a gameplay bug or an API shape bug?").
- **`planner`** — when QA surfaces a backlog slice rather than a single fix.
- **`builder`** — do not invoke from /qa. QA files bugs; builder ships fixes
  in its own flow.
- **`beck`** — when a bug needs a failing test before anyone touches production
  code. File the bug, attach the oracle, hand to beck.

## Gotchas

- **"CI is green" is not QA.** Dagger doesn't play through reveal. The
  evidence spec does. Run it.
- **Never run `pnpm dev` or `convex dev`.** The user's Convex dev server is
  load-bearing for your QA run — spawning a second one desyncs schema.
  Ask the user to confirm the dev server state; coordinate any restart.
- **Never push placeholder Canary keys to run QA.** Build-bearing lanes
  (Invariant #4) will kill the run. Use real values or run only the lanes
  that don't build.
- **Evidence output is ephemeral.** `LINEJAM_EVIDENCE_DIR` defaults to
  `$TMPDIR/linejam-evidence-<timestamp>`. Copy anything load-bearing into
  `/tmp/qa-<slug>/` before handing to `/demo` if you want it to survive
  reboot.
- **Canary event ID ≠ PostHog event.** PostHog is product analytics; Canary
  is the incident sink. QA findings attach Canary IDs, not PostHog.
- **Don't file to GitHub Issues.** `backlog.d/` is authoritative.
