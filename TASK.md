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
