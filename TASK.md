# TASK: Security Hardening & Build Fixes

## 1. Infrastructure

### [Infrastructure] Build command missing Convex deploy - breaks Vercel

**File**: package.json:9
**Severity**: HIGH
**Impact**: Build is `"build": "next build"` but Vercel needs Convex deployed first.
**Fix**: Update build script: `"build": "npx convex deploy && next build"`

## 2. Refactoring (Prerequisite)

### [Architecture] Duplicated getUser helper - 3 copies

**Files**: convex/game.ts, convex/poems.ts, convex/favorites.ts
**Impact**: 60+ lines duplicated.
**Fix**: Extract to `convex/lib/auth.ts`.
**Interface**:

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

## 3. Security

### [Security] Broken Access Control - getPoemDetail allows viewing any poem

**File**: convex/poems.ts
**Severity**: HIGH
**Fix**: Add participation check. Only room participants can view poems.

### [Security] Broken Access Control - getPoemsForRoom has no participation check

**File**: convex/poems.ts
**Severity**: HIGH
**Fix**: Verify caller participated in room before returning poems.

### [Security] Broken Access Control - getPoemsForUser/getFavoritesForUser expose any user's data

**Files**: convex/poems.ts, convex/favorites.ts
**Severity**: HIGH
**Fix**: Remove generic "get for any user" queries. Replace with `getMyPoems` and `getMyFavorites` that rely on implicit auth/guest ID.
