---
name: a11y
description: |
  Accessibility audit, remediation, and verification for Linejam. WCAG 2.2 AA
  across the four-theme matrix (kenya, mono, vintage-paper, hyper) and the
  game-screen surface (Lobby, WritingScreen, RevealPhase, RoomChrome,
  HelpModal). Three-agent protocol: audit -> remediate -> critique.
  Use when: "accessibility audit", "a11y", "WCAG", "contrast check",
  "screen reader", "keyboard navigation", "aria fix", "theme contrast",
  "WordSlots announcement", "focus trap", "help modal a11y".
  Trigger: /a11y
argument-hint: '[audit|fix|verify] [route|component|theme|--scope full]'
---

# /a11y — Linejam

Audit, fix, and verify accessibility. WCAG 2.2 AA, applied to Linejam's
four-theme × multi-screen regression matrix.

**Target:** $ARGUMENTS

## Why this skill is Linejam-specific

The spellbook version treats a11y as a single-palette, single-surface
problem. Linejam is different:

- **Four premium theme presets** (`lib/themes/presets/kenya.ts`,
  `mono.ts`, `vintage-paper.ts`, `hyper.ts`) each ship their own color,
  typography, motion, and shadow tokens. A fix that passes contrast in
  `kenya` can silently fail in `hyper` (neon-on-dark) or `vintage-paper`
  (small text on sepia). Every token change and every new component gets
  verified against **all four presets in both `light` and `dark` modes**
  — that's eight palettes, not one.
- **Guest-first flow.** Non-authenticated users must not be blocked from
  joining a room. Room-code entry, pen-name input, and the word-count
  indicator are on the critical path for unauthenticated screen-reader
  users.
- **Word-count ceremony.** `components/ui/WordSlots.tsx` is a
  Genkoyoushi-inspired indicator. The visual dots carry load-bearing
  semantics ("3 of 5 words") that must be announced.
- **Ceremonial animation.** The `.animate-stamp`, `.animate-breathe`,
  and theme-specific transitions in `app/globals.css` are part of the
  game feel — they must honor `prefers-reduced-motion` (already wired
  globally at `app/globals.css`, don't regress it).
- **Invariant #7.** `CLAUDE.md` mandates termination guards on every
  `while` loop. That rule applies to focus traps too — bounded iteration
  in `HelpModal.tsx`-style modal focus cycling, no "while not focused"
  spins.

## Execution Stance

You are the executive orchestrator.

- Keep severity decisions, scope tradeoffs, and final PASS/FAIL judgment
  on the lead model.
- Delegate audit, remediation, and critique to separate focused
  subagents. Named agents: `a11y-auditor`, `a11y-fixer`, `a11y-critic`.
- Prefer parallel exploration for independent checks (e.g., per-theme
  contrast probes). Keep remediation sequential when fixes interact.
- Dagger is the gate. Any fix that touches CSS variables, ARIA, or
  focus behavior must survive `pnpm ci:prepush`. Do not bypass with
  `--no-verify` (Invariant #1).

## Routing

| Intent                   | Action                                                  |
| ------------------------ | ------------------------------------------------------- |
| `/a11y` or `/a11y audit` | Full triad: audit → remediate → critique                |
| `/a11y audit <target>`   | Audit only — read `references/audit.md`                 |
| `/a11y fix <target>`     | Remediate only — read `references/remediate.md`         |
| `/a11y verify`           | Critique recent changes — read `references/critique.md` |

Target can be a component (`Lobby`, `WritingScreen`), a route
(`/room/[code]`, `/reveal`), a theme (`--theme=hyper`), or `--scope
full` (all four themes × all game screens).

## Three-Agent Protocol

### Phase 1: Audit (read-only)

Dispatch the `a11y-auditor` subagent. It
scans, it does not fix. When per-theme coverage is the goal, dispatch
four parallel auditors — one per preset — and synthesize.

**Automated scan (preferred when dev server is up):**

- Ask the user to confirm `pnpm dev` is running (Invariant #2 — never
  spawn Convex/Next yourself).
- Run Playwright + `@axe-core/playwright` against target routes with
  tags `wcag2a`, `wcag2aa`, `wcag22aa`. Recipe below.
- Re-run under every theme. Themes switch via the `data-theme`
  attribute set by `ThemeProvider`; swap in the test setup.

**Static scan (no server, or as first pass):**

- Source walk `components/`, `app/`, `lib/themes/presets/`.
- Grep for the anti-patterns below. Read the four preset files in full
  when anything touches color tokens.

**Static anti-pattern grep list:**

- `div onClick` / `span onClick` without `role`, `tabIndex`, and
  `onKeyDown`.
- `<img` without `alt=` (the poem OG image at
  `app/poem/[id]/opengraph-image.tsx` is a separate server-rendered
  surface — audit its alt semantics if any are exposed to clients).
- `<Button>` with only icon children and no `aria-label` — especially
  the `?` help affordance and the theme toggle.
- `<input` / `<select>` without associated `<label>` or `aria-label` —
  room-code input, pen-name input, line textarea.
- `tabindex` values > 0 (trap pattern; `HelpModal.tsx` currently uses
  `tabIndex={0}` correctly for the modal container, but verify no
  positive values anywhere else).
- `outline: none` / `outline: 0` without a replacement focus style.
  `textarea:focus` in `globals.css` sets `caret-color`; confirm an
  outline or ring is still present.

**Structural checks (game screens):**

- Landmarks: `<main>` on each route, `<header>`/`<footer>` in
  `components/Header.tsx` / `components/Footer.tsx`, `<nav
aria-label>` where applicable.
- Skip-to-content link as first focusable element on
  `app/layout.tsx` (currently absent — flag if still missing).
- Focus management on SPA route change (Next.js App Router does not do
  this for you; verify on `host → /room/[code]` transition).
- `role=alert` / `aria-live` wiring for `lib/errorFeedback.ts` output
  sites. Errors must be announced, not only styled.
- Dialog focus restoration on close — `HelpModal.tsx` has a
  `closeButtonRef.current?.focus()` pattern; verify it restores to the
  trigger, not the close button.
- `prefers-reduced-motion` — already set globally at
  `app/globals.css:252`; confirm no component overrides it.

**Linejam-specific checks:**

- **Room-code input.** `formatRoomCode('ABCD') → 'AB CD'`. The
  announced text must strip the space or use `aria-label="Room code
ABCD"` so screen readers don't read "AB space CD".
- **Pen-name capture.** Captured at write-time on the line. The input
  must have a visible `<label>` (not placeholder-only) since the pen
  name persists in the poem reveal.
- **WordSlots.** `components/ui/WordSlots.tsx` already sets
  `role="status"` and `aria-label="${current} of ${target} words"`.
  Verify no wrapping component overrides the `role` or truncates the
  label. Over-limit state must announce ("Over by N words"), not just
  recolor.
- **Writing textarea (`components/WritingScreen.tsx`).** Uses display
  font (intentional design break, see
  `docs/design-system.md#writing-screen-canvas-textarea`). Must still
  meet minimum target size (WCAG 2.5.8 AA, 24×24 CSS px) and have an
  associated label.
- **HelpModal focus trap (`components/HelpModal.tsx:35-46`).** Uses a
  Tab/Shift-Tab key handler with querySelectorAll focusable elements.
  Verify: (a) the loop is bounded (Invariant #7 — this one is event-
  driven, not a `while`, but sanity-check), (b) Escape closes, (c)
  focus restores to the `?` button on close.
- **Guest flow.** On `/join`, room-code entry + pen-name form must be
  traversable and submittable with keyboard only. Clerk sign-in must
  not steal focus when the user chose guest.

**Per-theme contrast matrix** (run axe color-contrast checks under all
eight palettes — four themes × {light, dark}):

| Theme             | Light mode risk                                                                                                                                                                                                                                                             | Dark mode risk                                                                                                                                                                     |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kenya` (default) | Persimmon `#e85d2b` on warm white `#faf9f7` for small text. Required: ≥4.5:1 small, ≥3:1 large. Verify `color-text-muted #a8a29e` on background.                                                                                                                            | Persimmon on `#1c1917`; `text-muted #a8a29e` on dark surface is borderline.                                                                                                        |
| `mono`            | Pure `#000` on `#fff` is fine, but `color-text-muted #737373` on `#fff` = 4.48:1 — fails small-text AA by a hair. Flag.                                                                                                                                                     | Inverted; same `#737373` muted on black = 4.83:1, passes. Hover states (`color-surface-hover #262626`) need non-contrast cue.                                                      |
| `vintage-paper`   | Small text `#8a837a` on sepia `#f5efe6` = borderline. Burgundy `#8b3a3a` on paper must pass 4.5:1.                                                                                                                                                                          | `#c4bdb4` on `#2a2521` for secondary text; `color-text-muted #8a837a` on dark paper is likely below AA.                                                                            |
| `hyper`           | Magenta `#ff00ff` on white for primary text = 3.14:1 — **fails** AA small. Only acceptable as decorative or large (≥3:1). `color-text-muted #666666` on white = 5.74:1, passes. Cyan focus ring `#00ffff` on white = 1.25:1 — **fails** non-text contrast (3:1). Flag both. | Acid green `#ccff00` on void `#050505` = ~17:1, fine. Hot-pink focus `#ff00ff` on void = 6.55:1, fine. But neon-on-neon state changes (hover, active) need a second non-color cue. |

Never declare a theme "clean" from one run — axe only catches ~50–60%
of issues, and per-theme contrast requires the palette actually applied
at test time.

**Output (per finding):**

```
## [SEVERITY] WCAG [criterion]: [title]
Theme(s): [kenya|mono|vintage-paper|hyper|all]
File: [path]:[line]
Issue: [what's wrong]
Fix: [specific change]
```

Ranked: critical → serious → moderate → minor. Read
`references/audit.md` for the full protocol.

### Phase 2: Remediate (writes code)

Dispatch the `a11y-fixer` subagent with the
audit output. One fixer at a time when fixes interact (same file or
same token); parallel fixers allowed for independent components.

**Priority order:**

1. **Accessible names** (critical) — every interactive control gets a
   name. Theme toggle, room-code-copy button, help `?` button, close
   modal, submit line.
2. **Keyboard access** (critical) — no div-as-button. Focus reachable
   across the guest flow without a pointer.
3. **Focus and dialogs** (critical) — trap focus in `HelpModal`, share
   sheet, and any future modal. Restore to trigger on close.
4. **Semantics** (high) — native `<button>`, `<nav>`, `<main>` over
   ARIA. Poem structure uses `<article>` + `<p>`, not divs.
5. **Forms and errors** (high) — `lib/errorFeedback.ts` messages go
   into `role="alert"` or `aria-live="polite"` regions. Required fields
   get both HTML `required` and `aria-required`.
6. **Announcements** (medium) — `aria-live` for dynamic content
   (round transitions, player joined, AI took a turn). `aria-expanded`
   on disclosure affordances.
7. **Contrast and states** (medium) — use tokens, not hardcoded hex.
   When a token fails AA in a theme, fix the token in the preset, not
   the consumer. All four presets in scope.
8. **Media and motion** (low) — `prefers-reduced-motion` preserved;
   alt text on any image surfaces.
9. **Tool boundaries** (critical) — minimal surgical diffs. Never
   rewrite unrelated components. Fix-what-you-touch applies but does
   not license scope creep.

**Linejam rules that override the generic fixer playbook:**

- **Mock boundaries (Invariant #5).** Tests may not mock `@/lib/*`,
  `@/hooks/*`, or `convex/lib/*`. If you need to assert a screen-reader
  announcement, use the real utility.
- **Tokens are shared.** Do not duplicate `color-focus-ring` per
  component. Change the preset if the value is wrong.
- **Dagger gate.** After each fix: `pnpm test <path>` then `pnpm
ci:dagger:lint` then `pnpm ci:dagger:unit-test`. Full
  `pnpm ci:prepush` before handing to the critic.
- **No amending.** Create a new atomic commit per logical fix
  (Conventional Commits).

Read `references/remediate.md` for the full protocol.

### Phase 3: Critique (read-only, cold review)

Dispatch the `a11y-critic` subagent. **No
shared context with the implementer.**

- Re-read the git diff without the fixer's explanations.
- Re-run axe under every theme touched (minimum: the default `kenya`
  plus whichever themes were in-scope).
- Keyboard-test: Tab through modified components, verify focus order
  and visibility under the new token values.
- Check for regressions: new violations, broken focus restoration,
  removed `prefers-reduced-motion` handling, tokens hardcoded where the
  fixer should have updated the preset.
- Verify `pnpm ci:prepush` is green.
- Verdict: **PASS** or **FAIL** with specific WCAG citations and file
  lines. If FAIL → back to Phase 2 with the critic's findings.

Read `references/critique.md` for the full protocol.

## Playwright + axe recipe

The E2E suite uses Playwright (`tests/e2e/`). Add axe coverage as a
targeted spec or, when the time comes, as a Dagger lane
(`pnpm ci:dagger:e2e` already runs the full suite). Wire per-theme
iteration explicitly; a single default run hides the matrix bugs this
skill exists to catch.

```ts
import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';

const THEMES = ['kenya', 'mono', 'vintage-paper', 'hyper'] as const;
const MODES = ['light', 'dark'] as const;

for (const theme of THEMES) {
  for (const mode of MODES) {
    test(`no a11y violations — lobby — ${theme}/${mode}`, async ({ page }) => {
      await page.goto('/room/TEST');
      // Apply theme via the same path ThemeProvider uses.
      await page.evaluate(
        ({ theme, mode }) => {
          document.documentElement.setAttribute('data-theme', theme);
          document.documentElement.classList.toggle('dark', mode === 'dark');
        },
        { theme, mode }
      );
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
        .analyze();
      expect(results.violations).toEqual([]);
    });
  }
}
```

For component-level coverage inside Vitest, use `vitest-axe` with a
`<ThemeProvider theme={...}>` wrapper and loop over the four presets.
Do not mock the preset modules (Invariant #5).

## Gotchas (Linejam-specific additions on top of the generic list)

1. **axe catches ~50–60% of issues** — never declare a theme "clean"
   from one automated run.
2. **`useQuery` errors are thrown, not returned** (session memory).
   Error boundaries are the mitigation. When an error boundary catches,
   the fallback UI must announce via `role="alert"`.
3. **Theme context is global** — tests that swap themes must clean up
   or they leak into later tests. See the gotcha in `CLAUDE.md`.
4. **`hyper` magenta-on-white fails small-text AA.** Do not use
   `color-primary` as body text in `hyper/light`. Design-system rule
   (`docs/design-system.md`): accent is for action and emphasis, not
   body text. Enforce in review.
5. **`mono` has no semantic state colors.** The preset intentionally
   drops `color-success/error/warning/info`. Error announcement still
   needs to work — use text ("Error:") and a border, not color alone.
6. **`vintage-paper` uses soft burgundy (`#8b3a3a` light / `#c76b6b`
   dark).** Verify both modes pass 4.5:1 for small and 3:1 for UI
   components. Borderline — re-check on every token edit.
7. **`kenya` persimmon focus ring** may visually disappear against
   surface colors at small sizes. Use the token `color-focus-ring`
   which is set to persimmon; verify it actually paints, and that ring
   thickness clears WCAG 2.4.13 (AAA, 2px + 3:1 contrast — aspirational
   but worth targeting).
8. **Focus traps must be bounded** (Invariant #7). The HelpModal uses
   event-driven Tab cycling, not a `while` loop — keep it that way.
   Any new modal pattern must follow suit.
9. **Share sheet + help modal are recurring problem surfaces.** They
   port between screens, they open over arbitrary backgrounds, and
   they own their own focus. Audit them explicitly on every sweep.
10. **Room-code spacing.** `formatRoomCode()` produces `AB CD`; screen
    readers will say "AB space CD". Always provide an `aria-label`
    without the space, e.g., `aria-label="Room code ABCD"`.
11. **WordSlots over-limit state.** Over-limit is signalled visually
    (a red slot). The `aria-label` must reflect overflow
    ("6 of 5 words — over by 1"), not just the raw count.
12. **`/api/health` vs Canary readiness** (Known Debt). a11y errors
    captured via `captureError()` from `lib/error.ts` flow through
    Canary. Missing Canary ingest is degraded observability, not
    gameplay failure — do not treat it as a blocker.

## WCAG 2.2 criteria we explicitly target

| Criterion                 | Level | What to check in Linejam                                                                                    |
| ------------------------- | ----- | ----------------------------------------------------------------------------------------------------------- |
| 1.4.3 Contrast (Minimum)  | AA    | All eight palettes; fix at the preset, not the consumer.                                                    |
| 1.4.11 Non-text Contrast  | AA    | Focus rings, word-count dots, stamp borders — ≥3:1 under every theme.                                       |
| 2.1.1 Keyboard            | A     | Full guest flow with keyboard only: join → lobby → write → reveal.                                          |
| 2.4.3 Focus Order         | A     | Lobby host controls, writing screen submit, reveal navigation.                                              |
| 2.4.11 Focus Not Obscured | AA    | `RoomChrome` header/footer do not cover focused elements.                                                   |
| 2.5.8 Target Size         | AA    | Theme toggle, copy-room-code button, help `?` button ≥ 24×24 CSS px.                                        |
| 3.2.6 Consistent Help     | A     | Help `?` button in same position across Lobby / Writing / Reveal.                                           |
| 3.3.7 Redundant Entry     | A     | Pen name is captured once and reused across rounds — honor this.                                            |
| 4.1.3 Status Messages     | AA    | Round advances, player-joined toasts, errors from `errorFeedback.ts` all use `aria-live` or `role="alert"`. |

## Testing Stack

| Tool                     | Layer  | When                                                                                                   |
| ------------------------ | ------ | ------------------------------------------------------------------------------------------------------ |
| `eslint-plugin-jsx-a11y` | Lint   | Every save, via Lefthook pre-commit + `pnpm ci:dagger:lint`.                                           |
| `vitest-axe`             | Unit   | Every component test. Wrap in `<ThemeProvider>` and loop presets.                                      |
| `@axe-core/playwright`   | E2E    | Targeted specs; per-theme × per-mode loop (recipe above). Add to `pnpm ci:dagger:e2e` when stabilized. |
| axe DevTools (browser)   | Dev    | Manual spot-checks under each theme.                                                                   |
| VoiceOver / NVDA         | Manual | Guest-flow validation (room-code entry, WordSlots announcements, reveal reading).                      |
| Keyboard-only            | Manual | Full nine-round cycle, every theme, at least once per release.                                         |

## Hand-off

On PASS, summarize: themes covered, WCAG criteria verified, files
touched, any deferred minor findings (with file paths and concrete
acceptance criteria — no "maybe" TODOs, Torvalds Test applies). On
FAIL, return the critic's findings verbatim to the fixer.
