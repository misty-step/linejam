# BACKLOG.md

Last groomed: 2025-11-18
Analyzed by: 8 specialized perspectives (complexity-archaeologist, architecture-guardian, security-sentinel, performance-pathfinder, maintainability-maven, user-experience-advocate, product-visionary, design-systems-architect)

---

## Now (Sprint-Ready, <2 weeks)

### [Security] Broken Access Control - getPoemDetail allows viewing any poem

**File**: convex/poems.ts:40-71
**Perspectives**: security-sentinel
**Severity**: HIGH
**Attack**: User navigates to `/poem/{anyId}` and views poems from games they didn't participate in. Privacy violation for personal/sensitive content.
**Fix**: Add participation check before returning poem:

```typescript
const roomPlayers = await ctx.db
  .query('roomPlayers')
  .withIndex('by_room_user', (q) =>
    q.eq('roomId', poem.roomId).eq('userId', user._id)
  )
  .first();
if (!roomPlayers) throw new Error('Unauthorized');
```

**Effort**: 30m | **Risk**: HIGH
**Acceptance**: Unauthorized access returns null/error, only participants can view poems

---

### [Security] Broken Access Control - getPoemsForUser/getFavoritesForUser expose any user's data

**Files**: convex/poems.ts:73-112, convex/favorites.ts:54-84
**Perspectives**: security-sentinel
**Severity**: HIGH
**Attack**: Enumerate user IDs to view all their game history and favorites.
**Fix**: Remove these functions or restrict to owner-only. Use `getMyPoems`/`getMyFavorites` pattern instead.
**Effort**: 15m each | **Risk**: HIGH
**Acceptance**: No way to query another user's poems/favorites

---

### [Security] Broken Access Control - getPoemsForRoom has no participation check

**File**: convex/poems.ts:4-38
**Perspectives**: security-sentinel
**Severity**: HIGH
**Attack**: Room codes are 4 uppercase letters (456K combinations). Brute-force enumeration finds active/completed rooms.
**Fix**: Verify caller participated in room before returning poems.
**Effort**: 20m | **Risk**: HIGH
**Acceptance**: Only room participants can view room poems

---

### [Infrastructure] Logger configured but never used ⚠️ MULTI-AGENT

**Files**: lib/logger.ts (configured), components/\*.tsx (6x console.error)
**Perspectives**: architecture-guardian, maintainability-maven, security-sentinel
**Impact**: No structured logging in production, no correlation IDs, can't debug issues
**Evidence**: `grep console.error` finds 6 occurrences in WritingScreen, RevealPhase, Lobby, join/page, host/page, assignmentMatrix
**Fix**: Replace all `console.error` calls:

```typescript
// Before
console.error('Failed to submit line:', error);
// After
import { logger } from '@/lib/logger';
logger.error({ error, roomCode, poemId }, 'Failed to submit line');
```

**Effort**: 1h | **Impact**: Production debugging enabled
**Acceptance**: Zero console.error in production code, all errors logged with context

---

### [Infrastructure] Sentry configured but never captures errors ⚠️ MULTI-AGENT

**Files**: sentry.\*.config.ts (configured), lib/sentry.ts (scrubbing), catch blocks (0 captures)
**Perspectives**: architecture-guardian, maintainability-maven, security-sentinel
**Impact**: Error tracking exists but catches nothing. No visibility into production errors.
**Fix**: Add `Sentry.captureException` in all catch blocks:

```typescript
import * as Sentry from '@sentry/nextjs';
} catch (error) {
  Sentry.captureException(error, { contexts: { room: { code: roomCode } } });
  logger.error({ error, roomCode }, 'Failed to submit line');
}
```

**Effort**: 1h | **Impact**: Error visibility in production
**Acceptance**: All catch blocks capture to Sentry with relevant context

---

### [Architecture] Duplicated getUser helper - 3 copies ⚠️ MULTI-AGENT (4 agents)

**Files**: convex/game.ts:8-28, convex/poems.ts:115-134, convex/favorites.ts:5-24
**Perspectives**: complexity-archaeologist, architecture-guardian, maintainability-maven, performance-pathfinder
**Impact**: 60+ lines duplicated. Comments acknowledge debt: "duplicated, should be shared but simple enough". Auth logic changes require 3 edits.
**Fix**: Extract to `convex/lib/auth.ts`:

```typescript
export async function getUser(
  ctx: QueryCtx | MutationCtx,
  guestId?: string
): Promise<Doc<'users'> | null>;
export async function requireUser(
  ctx: QueryCtx | MutationCtx,
  guestId?: string
): Promise<Doc<'users'>>;
```

**Effort**: 30m | **Impact**: Single source of truth for auth
**Acceptance**: One `getUser` implementation imported by all files

---

### [Performance] N+1 Queries in submitLine round completion check ⚠️ MULTI-AGENT

**File**: convex/game.ts:213-230
**Perspectives**: complexity-archaeologist, performance-pathfinder, maintainability-maven
**Impact**: 8 players = 9 sequential DB queries per submission. 72 submissions/game = 648 queries just for completion checks. Adds 100-200ms per submit.
**Fix**: Parallelize with `Promise.all`:

```typescript
const lineChecks = await Promise.all(
  poems.map((p) =>
    ctx.db
      .query('lines')
      .withIndex('by_poem_index', (q) =>
        q.eq('poemId', p._id).eq('indexInPoem', lineIndex)
      )
      .first()
  )
);
const allSubmitted = lineChecks.every((line) => line !== null);
```

**Effort**: 15m | **Speedup**: 5x (150ms → 30ms)
**Acceptance**: No sequential loops with DB queries in submitLine

---

### [Performance] N+1 Queries in getRoundProgress

**File**: convex/game.ts:391-428
**Perspectives**: performance-pathfinder
**Impact**: 8 players = up to 16 sequential queries. All players poll this on waiting screen. 320ms latency.
**Fix**: Batch fetch poems once, parallelize line checks.
**Effort**: 30m | **Speedup**: 6x (320ms → 50ms)
**Acceptance**: O(1) poem fetch + parallel line checks

---

### [Performance] N+1 Queries in getPoemDetail, getMyPoems, getPoemsForRoom

**Files**: convex/poems.ts:57-64, 153-173, 24-35
**Perspectives**: performance-pathfinder
**Impact**: getPoemDetail: 9 author lookups. getMyPoems: 150 queries for 50 poems. "My Collection" takes 3+ seconds.
**Fix**: Batch fetch with `Promise.all`, create author lookup maps.
**Effort**: 45m per function | **Speedup**: 5-10x
**Acceptance**: No for-loops with sequential DB queries

---

### [UX] Replace alert() with inline errors ⚠️ MULTI-AGENT

**Files**: components/Lobby.tsx:22, components/WritingScreen.tsx:59
**Perspectives**: user-experience-advocate, design-systems-architect
**Impact**: Browser alerts are jarring, break Zen aesthetic, can't be styled. Current: `alert('Only the host can start the game!')`
**Fix**: Add error state and inline error display:

```typescript
const [error, setError] = useState('');
// Show: <p className="text-sm text-[var(--color-error)]">{error}</p>
```

**Effort**: 30m total | **Impact**: Maintains aesthetic, better UX
**Acceptance**: Zero alert() calls in codebase

---

### [UX] Silent failure on room creation

**File**: app/host/page.tsx:35-38
**Perspectives**: user-experience-advocate
**Impact**: Host clicks "Create Room", button stops spinning, nothing happens. No feedback on failure.
**Fix**: Add error state and display message to user.
**Effort**: 15m | **Impact**: Users can recover from failures
**Acceptance**: Errors display user-friendly message

---

### [UX] No beforeunload warning for draft loss

**File**: components/WritingScreen.tsx
**Perspectives**: user-experience-advocate
**Impact**: User accidentally closes tab mid-game, loses draft text and disrupts game for all players.
**Fix**: Add `beforeunload` handler when textarea has content.
**Effort**: 15m | **Impact**: Prevents accidental draft loss
**Acceptance**: Browser warns before closing with unsaved text

---

### [UX] "Play Again" button does nothing ⚠️ MULTI-AGENT

**File**: components/RevealPhase.tsx:157-159
**Perspectives**: product-visionary, user-experience-advocate
**Impact**: Button renders with no onClick handler. Game session dead-ends. Users must manually navigate home, re-host, re-share code. High friction destroys replay momentum.
**Fix**: Implement `playAgain` mutation that creates new game in same room, resets to LOBBY status. OR remove the button.
**Effort**: 2-3h (implement) or 1m (remove) | **Impact**: CRITICAL for retention
**Acceptance**: Button either works or doesn't exist

---

### [Design] Profile page uses Tailwind grays instead of design tokens

**File**: app/me/profile/page.tsx
**Perspectives**: design-systems-architect
**Impact**: 8+ hardcoded gray values (`bg-gray-50`, `text-gray-500`, etc.). Page looks completely different from rest of app. Breaks visual coherence.
**Fix**: Replace all grays with design tokens:

```typescript
// Before: bg-gray-50 text-gray-500 border-gray-100
// After: bg-[var(--color-background)] text-[var(--color-text-muted)] border-[var(--color-border)]
```

**Effort**: 30m | **Impact**: Visual consistency restored
**Acceptance**: Zero Tailwind color utilities in profile page

---

### [Infrastructure] Build command missing Convex deploy - breaks Vercel

**File**: package.json:9
**Perspectives**: architecture-guardian
**Severity**: HIGH
**Impact**: Build is `"build": "next build"` but Vercel needs Convex deployed first. Deployments will fail because Convex schema/functions aren't available when Next.js builds.
**Fix**: Update build script:

```json
"build": "npx convex deploy && next build"
```

**Effort**: 5m | **Risk**: HIGH (deployment blocker)
**Acceptance**: Vercel builds succeed with Convex functions available

---

### [Infrastructure] Pre-commit typecheck too slow

**File**: lefthook.yml:17-19
**Perspectives**: maintainability-maven
**Impact**: Full `pnpm typecheck` runs on every commit regardless of files changed. Pre-commit should be <5s; typecheck alone can take 5-10s.
**Fix**: Remove typecheck from pre-commit (already runs in pre-push and CI):

```yaml
pre-commit:
  parallel: true
  commands:
    lint:
      # ...
    format:
      # ...
    # Remove typecheck - too slow for pre-commit
```

Add `--incremental` flag to pre-push typecheck for faster subsequent runs.
**Effort**: 10m | **Impact**: Pre-commit <5s, devs won't bypass hooks
**Acceptance**: Pre-commit completes in <5s for typical commits

---

### [Infrastructure] CI pipeline runs sequentially, wasting time

**File**: .github/workflows/ci.yml:32-45
**Perspectives**: performance-pathfinder
**Impact**: Lint → format:check → typecheck → test → build runs sequentially but first three are independent. Wastes 2-3 minutes per CI run.
**Fix**: Parallelize independent jobs:

```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    steps: [checkout, setup, install, lint]
  format:
    runs-on: ubuntu-latest
    steps: [checkout, setup, install, format:check]
  typecheck:
    runs-on: ubuntu-latest
    steps: [checkout, setup, install, typecheck]
  test-build:
    needs: [lint, format, typecheck]
    runs-on: ubuntu-latest
    steps: [checkout, setup, install, test:ci, build]
```

**Effort**: 30m | **Speedup**: ~2-3 min saved per run
**Acceptance**: Lint, format, typecheck run in parallel; test/build wait for all three

---

### [Security] No secrets scanning in git hooks

**File**: lefthook.yml
**Perspectives**: security-sentinel
**Severity**: MEDIUM
**Impact**: No pre-commit check for leaked secrets. CLERK_SECRET_KEY, SENTRY_AUTH_TOKEN could be committed accidentally.
**Fix**: Add gitleaks to pre-commit:

```yaml
pre-commit:
  parallel: true
  commands:
    secrets:
      run: gitleaks protect --staged --redact
```

Requires `brew install gitleaks` or CI installation.
**Effort**: 15m | **Impact**: Prevents secret leakage
**Acceptance**: Commits with secrets are blocked with clear error message

---

### [Infrastructure] Test coverage targets global instead of critical paths

**File**: vitest.config.ts:24-29
**Perspectives**: maintainability-maven
**Impact**: Global 60% threshold treats all code equally. Game logic in `convex/*.ts` has 0% coverage but passes. Profile page CSS could fail coverage but doesn't matter.
**Fix**: Target critical paths:

```typescript
thresholds: {
  'convex/*.ts': { lines: 80, functions: 80, branches: 80, statements: 80 },
  global: { lines: 50, functions: 50, branches: 50, statements: 50 },
}
```

**Effort**: 20m | **Impact**: Coverage enforced where it matters
**Acceptance**: CI fails if game logic drops below 80% coverage

---

### [Infrastructure] CI/Release branch naming inconsistency

**Files**: .github/workflows/ci.yml:6-7, release.yml:5
**Perspectives**: architecture-guardian
**Impact**: CI triggers on `main, master` but release only triggers on `master`. Could cause confusion or missed releases.
**Fix**: Standardize on `master` (current default) everywhere:

```yaml
# ci.yml
on:
  pull_request:
    branches: [master]
  push:
    branches: [master]
```

**Effort**: 5m | **Impact**: Consistency
**Acceptance**: All workflows use same branch name

---

### [Infrastructure] No analytics - zero user behavior visibility

**Perspectives**: product-visionary, user-experience-advocate
**Severity**: HIGH
**Impact**: No insight into user behavior, conversion funnels, or Core Web Vitals. Product decisions made by intuition. Can't measure if "Play Again" or "Share" features drive retention.
**Fix**: Install Vercel Analytics + Speed Insights:

```bash
pnpm add @vercel/analytics @vercel/speed-insights
```

```typescript
// app/layout.tsx
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
```

**Effort**: 15m | **Impact**: User behavior + Core Web Vitals visibility
**Acceptance**: Vercel dashboard shows page views, vitals, and can add custom events

---

### [Infrastructure] No test-error route for Sentry verification

**Perspectives**: maintainability-maven
**Severity**: MEDIUM
**Impact**: Can't verify Sentry captures work in production without breaking real functionality.
**Fix**: Create test error page:

```typescript
// app/test-error/page.tsx
'use client';
export default function TestError() {
  return (
    <button onClick={() => { throw new Error('Test Sentry capture'); }}>
      Trigger Test Error
    </button>
  );
}
```

**Effort**: 10m | **Impact**: Can verify error tracking in any environment
**Acceptance**: Visiting /test-error and clicking shows error in Sentry dashboard

---

### [Infrastructure] No health check endpoint

**Perspectives**: architecture-guardian
**Severity**: MEDIUM
**Impact**: No way for external uptime monitors (UptimeRobot, BetterUptime) to verify app is running. Downtime detection delayed until user reports.
**Fix**: Create health endpoint:

```typescript
// app/api/health/route.ts
export async function GET() {
  return Response.json({ status: 'ok', timestamp: new Date().toISOString() });
}
```

**Effort**: 10m | **Impact**: Enables external uptime monitoring
**Acceptance**: GET /api/health returns 200 with status ok

---

### [Infrastructure] No Sentry release automation in CI

**File**: .github/workflows/ci.yml
**Perspectives**: architecture-guardian
**Severity**: MEDIUM
**Impact**: Errors in Sentry can't be correlated with specific deployments. Can't answer "which deploy introduced this error?"
**Fix**: Add Sentry release step after build:

```yaml
- name: Create Sentry Release
  if: github.ref == 'refs/heads/master'
  run: |
    npx @sentry/cli releases new "${{ github.sha }}"
    npx @sentry/cli releases set-commits "${{ github.sha }}" --auto
    npx @sentry/cli releases finalize "${{ github.sha }}"
  env:
    SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
    SENTRY_ORG: ${{ secrets.SENTRY_ORG }}
    SENTRY_PROJECT: ${{ secrets.SENTRY_PROJECT }}
```

**Effort**: 30m | **Impact**: Deployment-correlated error tracking
**Acceptance**: Sentry errors show associated commits and can mark as resolved in release

---

### [Infrastructure] Session Replay sampling may consume quota quickly

**File**: sentry.client.config.ts:12
**Perspectives**: architecture-guardian
**Severity**: LOW
**Impact**: `replaysSessionSampleRate: 0.1` (10%) records 1 in 10 sessions. Sentry free tier has limited replay quota. May hit limits before catching errors.
**Recommendation**: Reduce to 0% routine sampling, keep 100% on errors:

```typescript
replaysSessionSampleRate: 0.0,  // Was 0.1
replaysOnErrorSampleRate: 1.0,  // Keep at 100%
```

**Effort**: 5m | **Impact**: Conserves quota for actual error debugging
**Acceptance**: Replays only captured when errors occur

---

## Next (This Quarter, <3 months)

### [Architecture] Split game.ts god object into focused modules

**File**: convex/game.ts (436 lines, 8 exports, 6 responsibilities)
**Perspectives**: architecture-guardian, complexity-archaeologist
**Why**: Single file handles game lifecycle, assignments, submission, validation, round progression, reveal management. "What does game.ts do?" → "Everything"
**Approach**: Split into:

- `convex/game/lifecycle.ts` - startGame
- `convex/game/assignments.ts` - getCurrentAssignment
- `convex/game/submission.ts` - submitLine, validation
- `convex/game/reveal.ts` - getRevealPhaseState, revealPoem
  **Effort**: 2h | **Impact**: Clear ownership, testable units

---

### [Maintainability] Document WORD_COUNTS magic constant ⚠️ MULTI-AGENT

**File**: convex/game.ts:6
**Perspectives**: complexity-archaeologist, maintainability-maven
**Why**: `const WORD_COUNTS = [1, 2, 3, 4, 5, 4, 3, 2, 1]` defines entire game mechanic with no explanation. Why pyramid? Why 9 rounds? Is this tunable?
**Fix**: Add comprehensive JSDoc explaining design intent, game balance, and change impact.
**Effort**: 5m | **Impact**: Core design documented

---

### [Maintainability] Add tests for Convex mutations/queries

**Files**: convex/\*.ts
**Perspectives**: maintainability-maven
**Why**: Zero test coverage for all backend functions. `startGame`, `submitLine`, `revealPoem` have no tests. Any refactor could break game without detection.
**Approach**: Create tests for critical paths:

- `startGame`: host-only, 2+ players, correct matrix/poems
- `submitLine`: word count validation, assignment validation
- `joinRoom`: room full, already started, existing player
  **Effort**: 4-6h | **Impact**: Refactoring confidence

---

### [Product] Implement Share/Export poems

**Perspectives**: product-visionary
**Why**: Primary growth vector. Poems exist only in-app. "Look what we made" moment dies in the room. Zero organic viral growth.
**Approach**:

- Share to social media with branded overlay
- Copy to clipboard for Discord/Slack
- Download as image for keepsakes
- Public poem permalink with OG tags
  **Effort**: 3-5d | **Value**: CRITICAL growth feature
  **Business Case**: Each share could bring 1-3 new players

---

### [Product] Add timer/pace control system

**Perspectives**: product-visionary
**Why**: No time pressure. Games can stall indefinitely. One slow player kills energy.
**Approach**: Configurable round timer (30/60/90s), visual countdown, auto-submit on expiry
**Effort**: 4-6h | **Value**: Transforms game feel
**Business Case**: Timers create energy and laughs

---

### [Product] Add QR code for room joining

**Perspectives**: product-visionary, user-experience-advocate
**Why**: Current join flow: navigate URL → click Join → type 4-letter code. QR code goes directly to pre-filled join page.
**Approach**: QR generation lib (qrcode.js), host displays for scanning
**Effort**: 2-3h | **Value**: Reduces onboarding friction 80%

---

### [UX] Add basic accessibility

**Perspectives**: user-experience-advocate
**Why**: Zero ARIA attributes in codebase. SVG icons without labels. No keyboard navigation for modals.
**Approach**:

- Add `aria-hidden="true"` to decorative icons
- Add `aria-label` to interactive buttons (favorites heart)
- Add `role="status" aria-live="polite"` to loading states
- Add Escape key handler for overlays
  **Effort**: 2h | **Impact**: Makes app usable for screen reader users

---

### [UX] Improve backend error messages

**Perspectives**: user-experience-advocate
**Why**: Technical messages like "Cannot join a room that is not in LOBBY status". Users don't understand jargon.
**Approach**: User-friendly messages:

- "This game has already started. Ask the host to create a new room."
- "This room is full (8/8 players)."
- "Room code 'ABCD' not found. Check the code and try again."
  **Effort**: 30m | **Impact**: Users can self-recover

---

### [Design] Extract PageContainer component

**Perspectives**: design-systems-architect
**Why**: Same 6-class pattern duplicated 15+ times:

```typescript
<div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-background)] p-6">
```

**Approach**: Create `components/ui/PageContainer.tsx`
**Effort**: 1.5h | **Impact**: DRY, easier to update

---

### [Design] Extract LoadingScreen component

**Perspectives**: design-systems-architect
**Why**: Each component implements loading state differently. Some "Loading...", some "Loading poems...", no spinners/skeletons.
**Approach**: Standardized loading screen with customizable message
**Effort**: 50m | **Impact**: Consistent loading experience

---

### [Security] Increase room code entropy

**File**: convex/rooms.ts:5-12
**Perspectives**: security-sentinel
**Why**: Only 456K combinations (26^4). Uses `Math.random()` (not cryptographically secure). No rate limiting.
**Approach**: 6-character alphanumeric (2.1B combinations), add rate limiting to getRoom/joinRoom
**Effort**: 1h | **Severity**: MEDIUM

---

### [Security] Server-side guest session management

**Files**: lib/auth.ts, Convex functions
**Perspectives**: security-sentinel
**Why**: Guest ID is client-controlled. User can impersonate another guest by copying localStorage value.
**Approach**: Generate guestId server-side, use signed/encrypted session tokens
**Effort**: 2h | **Severity**: MEDIUM

---

## Soon (Exploring, 3-6 months)

- **[Product] Game mode variations** - Haiku (5-7-5), Limerick (AABBA), Speed mode (30s timer), Theme mode (random prompts). Major replay value. Premium tier candidate.
- **[Product] Sound/audio feedback** - Ambient music, submit/round/reveal effects. "Feels like a real game" polish.
- **[Product] Player avatars** - Emoji or preset images, color assignments. Identity and fun, premium candidate.
- **[Product] Spectator mode** - Non-players watch reveal phase. Good for events/streams, larger groups.
- **[Architecture] Create React hook abstractions for Convex** - Components directly import `api` generated types. Can't swap backend without changing all components.
- **[Security] Implement rate limiting** - Room creation, joining, line submission. Prevents DoS and enumeration.
- **[Design] Enhance Input component** - Add label, error, hint props with accessibility attributes. Transform shallow wrapper into deep module.
- **[Testing] Visual regression via Playwright** - Screenshots for key states. Refactoring confidence.

---

## Later (Someday/Maybe, 6+ months)

- **[Product] Premium tier** - Game modes, room size, advanced sharing. $5/month or $20/year.
- **[Product] Education package** - Teacher dashboard, themes/prompts, content moderation. $5/student/year.
- **[Product] Corporate package** - Large rooms (50+), branding, SSO. $500-2000/event.
- **[Product] Slack/Discord bot** - Play inside chat apps. New distribution channel.
- **[Product] AI-assisted mode** - AI completes lines when stuck. Premium differentiator.
- **[Platform] Mobile app** - iOS/Android native or React Native
- **[Platform] Plugin system** - User-extensible commands

---

## Learnings

**From this grooming session:**

1. **Infrastructure exists but isn't used** - Logger and Sentry are perfectly configured but zero calls in application code. The "build it" was done, the "use it" was forgotten. Pattern: infrastructure setup without adoption.

2. **Authorization was overlooked in MVP** - All Convex queries return data without checking if caller should have access. Pattern: authentication ≠ authorization.

3. **N+1 queries in Convex look different** - Sequential `await ctx.db.query()` in loops. Same performance problem as SQL N+1, but the pattern is less obvious. Every loop with DB access is suspect.

4. **The 80/20 for party games** - Share, rematch, timer. Without these three features, retention is fundamentally broken. Play Again button being a no-op is critical.

5. **Design tokens work** - The Zen Garden system in globals.css is excellent. One file (Profile) bypassed it and immediately stands out as broken. Tokens create visual coherence; violations are obvious.

6. **Quality gates exist but aren't optimized** - Lefthook is configured but runs full typecheck on every commit (too slow). CI runs sequentially despite independent steps. No secrets scanning. Pattern: quality infrastructure setup without performance tuning.

---

## Summary

| Priority | Count    | Effort  | Key Theme                                                                            |
| -------- | -------- | ------- | ------------------------------------------------------------------------------------ |
| Now      | 26 items | ~18-24h | Security, infrastructure usage, N+1 queries, UX basics, quality gates, observability |
| Next     | 12 items | ~40-50h | Architecture refactoring, product growth features, testing                           |
| Soon     | 8 items  | ~60h    | Game variations, polish, advanced features                                           |
| Later    | 7 items  | 100h+   | Monetization, verticals, platform plays                                              |

**Most impactful quick wins:**

1. Extract `getUser` helper (30m) - eliminates 60 lines of duplication
2. Replace `alert()` with inline errors (30m) - fixes jarring UX
3. Migrate profile page to design tokens (30m) - restores visual coherence
4. Parallelize N+1 queries (2h) - 5-10x performance improvement

**Critical security work:**

- Authorization checks on all poem/favorites queries (1-2h)
- Without this, any user can view any other user's content
