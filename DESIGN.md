# DESIGN.md — Share/Export Poems

## Architecture Overview

**Selected Approach**: Modular enhancement of existing poem detail page

**Rationale**: The poem page already exists (`app/poem/[id]/page.tsx`), has favorite functionality, and follows established patterns. We add ShareButton inline, create a public Convex query for the OG image, and leverage Next.js's file-convention OG image generation. No new architectural patterns—just extensions of existing ones.

**Core Modules**:

- `lib/tokens.ts`: Shared color/font constants (single source of truth for CSS + OG image)
- `convex/poems.ts`: Add `getPublicPoemPreview` query (no auth required)
- `convex/shares.ts`: New file with `logShare` mutation + `shares` table
- `app/poem/[id]/opengraph-image.tsx`: Dynamic OG image generation at edge
- `app/poem/[id]/page.tsx`: Add `generateMetadata()` + ShareButton

**Data Flow**:

```
Social Platform Request → /poem/[id] metadata → opengraph-image.tsx → getPublicPoemPreview → PNG
User Click "Share This" → clipboard.writeText(url) → logShare mutation → analytics
```

**Key Design Decisions**:

1. **Inline ShareButton** vs separate component: Only one use case, simple enough to inline (follows RoomQr pattern)
2. **Public query for OG**: Poems are public via URL—no auth check needed for preview data
3. **Fire-and-forget analytics**: Don't block clipboard copy on analytics success
4. **Tokens extraction**: OG image can't use CSS variables—need JS constants

---

## Module Design

### Module: `lib/tokens.ts` (NEW)

**Responsibility**: Single source of truth for design tokens used in both CSS and runtime contexts (OG image generation).

**Public Interface**:

```typescript
// lib/tokens.ts
export const tokens = {
  colors: {
    background: '#faf9f7', // Rice paper
    foreground: '#1c1917', // Sumi ink
    primary: '#e85d2b', // Persimmon stamp
    textMuted: '#57534e', // Secondary text
  },
  fonts: {
    display: 'Libre Baskerville',
    sans: 'IBM Plex Sans',
  },
} as const;

export type Tokens = typeof tokens;
```

**Internal Implementation**:

- Simple object export, no complex logic
- `as const` ensures type safety
- Colors match globals.css @theme values exactly

**Dependencies**:

- Requires: None
- Used by: `opengraph-image.tsx`, potentially future components needing runtime tokens

**Error Handling**: N/A (static data)

---

### Module: `convex/poems.ts` (MODIFY)

**Responsibility**: Add public query for poem preview data (no auth required).

**New Public Interface**:

```typescript
// Add to existing convex/poems.ts
export const getPublicPoemPreview = query({
  args: { poemId: v.id('poems') },
  handler: async (ctx, { poemId }): Promise<{
    lines: string[];
    poetCount: number;
    poemNumber: number;
  } | null>
});
```

**Internal Implementation** (pseudocode):

```pseudocode
function getPublicPoemPreview(poemId):
  1. Fetch poem by ID
     - poem = db.get(poemId)
     - if !poem: return null

  2. Fetch first 3 lines
     - lines = db.query('lines')
       .withIndex('by_poem', poemId)
       .take(3)
     - sort by indexInPoem

  3. Count unique poets
     - allLines = db.query('lines')
       .withIndex('by_poem', poemId)
       .collect()
     - poetCount = new Set(lines.map(l => l.authorUserId)).size

  4. Return preview data
     - return {
         lines: lines.map(l => l.text),
         poetCount,
         poemNumber: poem.indexInRoom + 1
       }
```

**Why no auth check?**

- Poems are publicly shareable via URL
- If someone has the URL, they can see the preview
- This enables OG image generation without user session
- Full poem detail still requires auth (existing `getPoemDetail`)

**Error Handling**:

- Invalid poemId → return null (OG image will show fallback)

---

### Module: `convex/shares.ts` (NEW)

**Responsibility**: Analytics for share tracking.

**Public Interface**:

```typescript
// convex/shares.ts
export const logShare = mutation({
  args: { poemId: v.id('poems') },
  handler: async (ctx, { poemId }): Promise<void>
});
```

**Internal Implementation** (pseudocode):

```pseudocode
function logShare(poemId):
  1. Verify poem exists (basic validation)
     - poem = db.get(poemId)
     - if !poem: return (silent fail)

  2. Insert share record
     - db.insert('shares', {
         poemId,
         createdAt: Date.now()
       })
```

**Schema Addition** (`convex/schema.ts`):

```typescript
shares: defineTable({
  poemId: v.id('poems'),
  createdAt: v.number(),
})
  .index('by_poem', ['poemId'])
  .index('by_created', ['createdAt']),
```

**Design Decision**: No user tracking

- TASK.md says "simple count, no type tracking"
- Future: Add userId/guestToken if needed for per-user analytics
- Current: Just count shares per poem

**Error Handling**:

- Invalid poemId → silent return (fire-and-forget)
- Database error → Convex handles, logged internally

---

### Module: `app/poem/[id]/opengraph-image.tsx` (NEW)

**Responsibility**: Generate dynamic 1200×630 PNG for social sharing.

**Public Interface** (Next.js file convention):

```typescript
// Automatic route: /poem/[id]/opengraph-image
// Returns: PNG image response
export default async function Image({ params }: { params: { id: string } });
export const runtime = 'edge';
export const contentType = 'image/png';
export const size = { width: 1200, height: 630 };
```

**Internal Implementation** (pseudocode):

```pseudocode
function Image({ params }):
  1. Fetch poem preview (no auth)
     - poemId = params.id as Id<'poems'>
     - preview = await convex.query(api.poems.getPublicPoemPreview, { poemId })

  2. Handle missing poem
     - if !preview: return fallback image (Linejam branding only)

  3. Load fonts from Google Fonts
     - libreBaskerville = fetch('https://fonts.gstatic.com/s/librebaskerville/v14/...')
     - ibmPlexSans = fetch('https://fonts.gstatic.com/s/ibmplexsans/v19/...')

  4. Truncate lines (max 80 chars)
     - lines = preview.lines.map(line =>
         line.length > 80 ? line.slice(0, 77) + '...' : line
       )

  5. Render ImageResponse
     - return new ImageResponse(
         <div style={containerStyle}>
           {/* Poem lines */}
           {lines.map(line => <p style={lineStyle}>{line}</p>)}

           {/* Divider */}
           <div style={dividerStyle} />

           {/* Metadata */}
           <div style={metaStyle}>
             By {poetCount} poet{poetCount !== 1 ? 's' : ''} · linejam.com
           </div>

           {/* Persimmon stamp */}
           <div style={stampStyle} />
         </div>,
         { width: 1200, height: 630, fonts }
       )
```

**Styling Constants** (from lib/tokens.ts):

```typescript
const containerStyle = {
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  height: '100%',
  backgroundColor: tokens.colors.background,
  padding: '60px 80px',
  fontFamily: tokens.fonts.display,
};

const lineStyle = {
  fontSize: '40px',
  lineHeight: '1.3',
  color: tokens.colors.foreground,
  margin: '0 0 12px 0',
};

const dividerStyle = {
  width: '120px',
  height: '2px',
  backgroundColor: tokens.colors.primary,
  marginTop: 'auto',
};

const metaStyle = {
  fontSize: '18px',
  fontFamily: tokens.fonts.sans,
  color: tokens.colors.textMuted,
  marginTop: '16px',
};

const stampStyle = {
  position: 'absolute',
  bottom: '60px',
  right: '80px',
  width: '48px',
  height: '48px',
  borderRadius: '50%',
  backgroundColor: tokens.colors.primary,
};
```

**Font Loading**:

```typescript
// Google Fonts URLs (subset for weight 400)
const fontUrls = {
  libreBaskerville:
    'https://fonts.gstatic.com/s/librebaskerville/v14/kmKnZrc3Hgbbcjq75U4uslyuy4kn0qNXaxM.woff2',
  ibmPlexSans:
    'https://fonts.gstatic.com/s/ibmplexsans/v19/zYXgKVElMYYaJe8bpLHnCwDKhdHeFaxO.woff2',
};
```

**Error Handling**:

- Font load fails → fallback to system fonts (try/catch)
- Preview fetch fails → show generic Linejam branding image
- Invalid ID → 404 (Next.js handles)

**Performance**:

- Edge runtime for global low latency
- Fonts cached after first request
- Image cached by CDN (Vercel handles)

---

### Module: `app/poem/[id]/page.tsx` (MODIFY)

**Responsibility**: Add metadata generation + ShareButton to existing poem page.

**Changes Required**:

1. **Split into Server + Client Components**

Current structure (client-only):

```typescript
'use client';
export default function PoemDetailPage() { ... }
```

New structure (server wrapper + client detail):

```typescript
// page.tsx (server component - default)
import { PoemDetail } from './PoemDetail';
export { generateMetadata } from './metadata';

export default function Page({ params }: { params: { id: string } }) {
  return <PoemDetail poemId={params.id} />;
}

// PoemDetail.tsx (client component)
'use client';
export function PoemDetail({ poemId }: { poemId: string }) {
  // existing implementation...
  // + ShareButton at bottom
}
```

2. **Add generateMetadata**:

```typescript
// metadata.ts (server)
export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const preview = await convex.query(api.poems.getPublicPoemPreview, {
    poemId: params.id as Id<'poems'>,
  });

  if (!preview) {
    return { title: 'Poem Not Found | Linejam' };
  }

  const title = `Poem No. ${preview.poemNumber} | Linejam`;
  const description = preview.lines.slice(0, 2).join(' / ') + '...';

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      siteName: 'Linejam',
      // opengraph-image.tsx generates the image automatically
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}
```

3. **Add ShareButton inline**:

```typescript
// Inside PoemDetail.tsx, after poem content
<ShareButton poemId={poemId} poemNumber={poem.indexInRoom + 1} />

// ShareButton implementation (inline, follows RoomQr pattern)
function ShareButton({ poemId, poemNumber }: { poemId: Id<'poems'>; poemNumber: number }) {
  const [copied, setCopied] = useState(false);
  const logShare = useMutation(api.shares.logShare);

  const handleShare = async () => {
    const url = `${window.location.origin}/poem/${poemId}`;

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      // Fire-and-forget analytics
      logShare({ poemId }).catch(() => {}); // Silent fail
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      captureError(err, { operation: 'sharePoem', poemId });
      // TODO: Fallback to selectable text modal (Phase 2)
    }
  };

  return (
    <Button
      variant="primary"
      size="md"
      onClick={handleShare}
      stampAnimate={copied}
      aria-label="Copy poem link to clipboard"
    >
      {copied ? 'Copied!' : 'Share This'}
    </Button>
  );
}
```

**Accessibility**:

- Button has `aria-label` for screen readers
- Add `aria-live` region for copy confirmation:

```tsx
<div aria-live="polite" className="sr-only">
  {copied && 'Link copied to clipboard'}
</div>
```

---

## File Organization

```
lib/
  tokens.ts              # NEW: Shared design tokens

convex/
  schema.ts              # MODIFY: Add shares table
  poems.ts               # MODIFY: Add getPublicPoemPreview
  shares.ts              # NEW: logShare mutation

app/poem/[id]/
  page.tsx               # MODIFY: Server wrapper + metadata export
  PoemDetail.tsx         # NEW: Client component (extract from page.tsx)
  metadata.ts            # NEW: generateMetadata function
  opengraph-image.tsx    # NEW: Dynamic OG image generation
```

---

## Integration Points

### Convex Schema Addition

```typescript
// Add to convex/schema.ts
shares: defineTable({
  poemId: v.id('poems'),
  createdAt: v.number(),
})
  .index('by_poem', ['poemId'])
  .index('by_created', ['createdAt']),
```

### Environment Variables

No new environment variables required. Existing:

- `NEXT_PUBLIC_CONVEX_URL` — Convex deployment URL
- `CONVEX_DEPLOYMENT` — Convex deployment name

### External Dependencies

No new npm packages required. Using:

- `next/og` (built-in) — ImageResponse for OG images
- Existing `convex/react` — Data fetching

---

## State Management

**Client State**:

- `copied: boolean` — ShareButton local state (2-second feedback)
- No new global state required

**Server State**:

- `shares` table in Convex (append-only log)
- No caching layer (Convex handles reactivity)

---

## Error Handling Strategy

| Scenario                    | User Experience             | Implementation             |
| --------------------------- | --------------------------- | -------------------------- |
| Clipboard permission denied | Button stays "Share This"   | try/catch, captureError    |
| Clipboard API unsupported   | Same (TODO: fallback modal) | Feature detection          |
| OG font loading fails       | System serif fallback       | try/catch in ImageResponse |
| Invalid poem ID (page)      | 404 page                    | notFound() from Next.js    |
| Invalid poem ID (OG)        | Generic branding image      | Return fallback in Image() |
| Analytics fails             | Silent (user unaware)       | .catch(() => {})           |

**Error Response Pattern** (for future API expansion):

```typescript
// Convex mutations/queries return null or throw
// Client catches and reports to Sentry
```

---

## Testing Strategy

**Unit Tests** (Vitest):

- `lib/tokens.ts` — Type safety (compile-time)
- `convex/poems.ts` → `getPublicPoemPreview`:
  - Returns correct structure for valid poem
  - Returns null for invalid poem
  - Returns correct poet count (unique authors)
  - Truncates at 3 lines
- `convex/shares.ts` → `logShare`:
  - Inserts share record
  - Silent fail for invalid poemId

**Integration Tests**:

- OG image renders correctly (visual snapshot or pixel comparison)
- Full share flow: click → clipboard → analytics

**E2E Tests** (future):

- Share button visible on poem page
- Copied state shows animation
- URL in clipboard matches poem

**Mocking Strategy**:

- Mock `navigator.clipboard` in unit tests
- Use Convex test harness for mutation tests
- No mocking of internal functions (test behavior, not implementation)

---

## Performance Considerations

**Expected Load**:

- Low volume initially (< 100 shares/day)
- OG image requests: ~same as poem page views

**Optimizations**:

- Edge runtime for OG image (< 50ms generation)
- CDN caching of OG images (Vercel automatic)
- Fire-and-forget analytics (no await on mutation)
- Batch font loading (both fonts in parallel)

**Image Generation Performance**:

```
Target: < 500ms cold, < 100ms warm (edge-cached)
Measured: TBD after implementation
```

---

## Security Considerations

**Threats Addressed**:

- No user data exposed in public preview (just poem text, count)
- No PII in OG images (author names excluded)
- Rate limiting not needed (read-only public data)

**Not in Scope** (deferred):

- Share count spam prevention (add rate limiting at 1000+ shares)
- CAPTCHA (not needed for simple counter)

---

## Alternative Architectures Considered

### Alternative A: Separate Share Service

- **Pros**: Isolated analytics, could be serverless function
- **Cons**: Additional deployment, network hop, overkill for counter
- **Verdict**: Rejected — Convex mutation is simpler, sufficient

### Alternative B: External OG Image Service (og-image.vercel.app)

- **Pros**: Battle-tested, no custom code
- **Cons**: External dependency, less control over styling, doesn't match design system
- **Verdict**: Rejected — Next.js built-in `opengraph-image.tsx` is simpler and matches our stack

### Alternative C: Store Share Count on Poem Document

- **Pros**: One fewer table, atomic increment
- **Cons**: Loses timestamp data, can't analyze share patterns
- **Verdict**: Rejected — Separate table enables future analytics (shares over time, etc.)

**Selected**: Inline modifications to existing patterns

- **Justification**: Minimal new code, follows existing conventions (RoomQr clipboard, Convex mutations), no new architectural patterns to learn

---

## Implementation Sequence

**Phase 1: Foundation (~30 min)**

1. Create `lib/tokens.ts`
2. Add `shares` table to `convex/schema.ts`
3. Create `convex/shares.ts` with `logShare`

**Phase 2: Public Query (~30 min)** 4. Add `getPublicPoemPreview` to `convex/poems.ts`

**Phase 3: OG Image (~1 hour)** 5. Create `app/poem/[id]/opengraph-image.tsx`

**Phase 4: Metadata + ShareButton (~1 hour)** 6. Split `app/poem/[id]/page.tsx` into server/client components 7. Create `metadata.ts` with `generateMetadata` 8. Add ShareButton to `PoemDetail.tsx`

**Phase 5: Polish (~30 min)** 9. Add accessibility (aria-live region) 10. Test on social platforms (Twitter, Discord, Slack)

**Total: ~3.5 hours** (matches TASK.md estimate)

---

## Success Metrics

**Immediate** (Day 1):

- [ ] Share button renders on poem page
- [ ] OG image displays correctly on Twitter/Discord/Slack
- [ ] Clipboard copy works with visual feedback

**Week 1**:

- Share count logged (query: `SELECT COUNT(*) FROM shares`)
- No errors in Sentry related to sharing

**Month 1**:

- Referral traffic measurable (if UTM tracking added)
- Share-to-view ratio calculable

---

## Open Questions (Resolved)

1. **Q: Should we extract ShareButton to `components/`?**
   A: No, inline in page. Only one use case. Extract if reused.

2. **Q: Should OG image include author names?**
   A: No, per TASK.md spec. "By N poets" is sufficient and avoids PII.

3. **Q: Clipboard fallback modal needed for MVP?**
   A: Deferred. Modern browsers support clipboard API. Add if users report issues.
